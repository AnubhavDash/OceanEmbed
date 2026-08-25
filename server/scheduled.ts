import type { Request, Response } from "express";
import { createOceanRunIfAbsent, getPipelineConfigByTaskUid } from "./db";
import { getDailyRunId } from "./operations";
import { sdk } from "./_core/sdk";

type RefreshGateConfig = { enabled: number; dataSourceStatus: "unconfigured" | "ready" | "degraded"; modelEndpointStatus: "unconfigured" | "ready" | "degraded" };

export function evaluateRefreshGate(config: RefreshGateConfig | undefined) {
  if (!config) return { allowed: false, reason: "orphan" as const };
  if (!config.enabled) return { allowed: false, reason: "pipeline-disabled" as const };
  if (config.dataSourceStatus !== "ready" || config.modelEndpointStatus !== "ready") return { allowed: false, reason: "pipeline-not-ready" as const };
  return { allowed: true, reason: "ready" as const };
}

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
    const gate = evaluateRefreshGate(config);
    if (gate.reason === "pipeline-disabled") return res.json({ ok: true, skipped: gate.reason });
    if (!gate.allowed) {
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
