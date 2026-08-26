import { describe, expect, it, vi } from "vitest";
import { dispatchAwsWorker } from "./workerDispatch";

const input = { runId: "nio-2026-08-26", regionName: "North Indian Ocean", sourceManifestKey: "runs/nio-2026-08-26/manifest.json", requestedAt: "2026-08-26T03:30:00.000Z" };

describe("AWS worker dispatch", () => {
  it("sends a signed POST only to the configured worker URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ requestId: "aws-job-1" }), { status: 202 }));
    await expect(dispatchAwsWorker(input, fetchImpl, { url: "https://worker.example.test/run", secret: "dispatch-secret" })).resolves.toEqual({ accepted: true, requestId: "aws-job-1" });
    expect(fetchImpl).toHaveBeenCalledWith("https://worker.example.test/run", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer dispatch-secret" }) }));
  });

  it("refuses to queue a handoff without a configured worker boundary", async () => {
    await expect(dispatchAwsWorker(input, fetch, {})).rejects.toThrow("AWS worker dispatch is unconfigured");
  });
});
