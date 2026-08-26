export type WorkerDispatchInput = {
  runId: string;
  regionName: string;
  sourceManifestKey: string;
  requestedAt: string;
};

export type WorkerDispatchResult = { accepted: true; requestId?: string };

export async function dispatchAwsWorker(
  input: WorkerDispatchInput,
  fetchImpl: typeof fetch = fetch,
  config: { url?: string; secret?: string } = {
    url: process.env.AWS_WORKER_DISPATCH_URL,
    secret: process.env.AWS_WORKER_DISPATCH_SECRET,
  },
): Promise<WorkerDispatchResult> {
  if (!config.url || !config.secret) {
    throw new Error("AWS worker dispatch is unconfigured. Set AWS_WORKER_DISPATCH_URL and AWS_WORKER_DISPATCH_SECRET in Vercel.");
  }
  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`AWS worker dispatch failed with HTTP ${response.status}.`);
  const payload = await response.json().catch(() => ({})) as { requestId?: string };
  return { accepted: true, requestId: payload.requestId };
}
