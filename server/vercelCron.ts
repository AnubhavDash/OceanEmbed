import { createOceanRunIfAbsent, getPipelineConfigById } from "./db";
import { getDailyRunId } from "./operations";
import { dispatchAwsWorker, type WorkerDispatchResult } from "./workerDispatch";

export function isVercelCronAuthorized(authorization: string | undefined, secret: string | undefined) {
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

/**
 * Vercel cron is deliberately a short orchestration request. It creates one
 * idempotent queued run and leaves OpenCV plus model execution to the AWS
 * worker/endpoint. It never performs heavy data processing in a Vercel Function.
 */
export async function enqueueVercelDailyRefresh(
  now = new Date(),
  dispatch: (input: Parameters<typeof dispatchAwsWorker>[0]) => Promise<WorkerDispatchResult> = dispatchAwsWorker,
) {
  const config = await getPipelineConfigById("north-indian-ocean-daily");
  if (!config) return { ok: true as const, skipped: "pipeline-unconfigured" as const };
  if (!config.enabled) return { ok: true as const, skipped: "pipeline-disabled" as const };
  if (config.dataSourceStatus !== "ready" || config.modelEndpointStatus !== "ready") {
    return { ok: false as const, error: "pipeline-not-ready" as const };
  }
  const runId = getDailyRunId(now);
  const result = await createOceanRunIfAbsent({
    id: runId,
    status: "queued",
    asOf: now,
    regionName: config.regionName,
    sourceManifestKey: `runs/${runId}/manifest.json`,
    datasetVersion: "pending-approved-source",
    modelVersion: "pending-sagemaker-endpoint",
    codeVersion: "vercel-cron",
    confidence: "insufficient",
    fallbackMode: "human_review",
    scheduleCronTaskUid: "vercel-cron",
  });
  if (!result.created) return { ok: true as const, idempotent: true, runId: result.runId, handoff: "already-queued" as const };
  const handoff = await dispatch({ runId: result.runId, regionName: config.regionName, sourceManifestKey: `runs/${runId}/manifest.json`, requestedAt: now.toISOString() });
  return { ok: true as const, idempotent: false, runId: result.runId, handoff: "dispatched" as const, workerRequestId: handoff.requestId };
}
