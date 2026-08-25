import type { Request, Response } from "express";
import { createOceanRunIfAbsent, getPipelineConfigByTaskUid } from "./db";
import { getDailyRunId } from "./operations";
import { sdk } from "./_core/sdk";

/**
 * The production daily scene-refresh callback. It is intentionally conservative:
 * it will not generate a scene while approved source data and model-serving
 * credentials are unconfigured, and it only accepts platform-issued cron calls.
 */
export async function refreshNorthIndianOceanScene(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });

    const config = await getPipelineConfigByTaskUid(user.taskUid);
    if (!config) return res.json({ ok: true, skipped: "orphan" });
    if (!config.enabled) return res.json({ ok: true, skipped: "pipeline-disabled" });
    if (config.dataSourceStatus !== "ready" || config.modelEndpointStatus !== "ready") {
      return res.status(424).json({
        error: "pipeline-not-ready",
        message: "Approved surface-data and inference connections must be configured before a scheduled scene can run.",
        taskUid: user.taskUid,
      });
    }

    const asOf = new Date();
    const runId = getDailyRunId(asOf);
    const result = await createOceanRunIfAbsent({
      id: runId,
      status: "queued",
      asOf,
      regionName: config.regionName,
      sourceManifestKey: `runs/${runId}/manifest.json`,
      datasetVersion: "pending-approved-source",
      modelVersion: "pending-sagemaker-endpoint",
      codeVersion: "pending-release",
      confidence: "insufficient",
      fallbackMode: "human_review",
      scheduleCronTaskUid: user.taskUid,
    });
    return res.json({ ok: true, idempotent: !result.created, runId: result.runId, next: "dispatch-approved-data-and-inference-workflow" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "scheduled-refresh-failed", message, timestamp: new Date().toISOString() });
  }
}
