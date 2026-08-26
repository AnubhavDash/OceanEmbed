import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPipelineConfigById: vi.fn(),
  createOceanRunIfAbsent: vi.fn(),
}));

vi.mock("./db", () => ({
  getPipelineConfigById: mocks.getPipelineConfigById,
  createOceanRunIfAbsent: mocks.createOceanRunIfAbsent,
}));

import { enqueueVercelDailyRefresh } from "./vercelCron";

describe("Vercel daily refresh worker handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPipelineConfigById.mockResolvedValue({ enabled: 1, dataSourceStatus: "ready", modelEndpointStatus: "ready", regionName: "North Indian Ocean" });
  });

  it("dispatches a signed worker request after a new run is durably queued", async () => {
    mocks.createOceanRunIfAbsent.mockResolvedValue({ created: true, runId: "nio-2026-08-26" });
    const dispatch = vi.fn().mockResolvedValue({ accepted: true, requestId: "worker-job-1" });
    await expect(enqueueVercelDailyRefresh(new Date("2026-08-26T03:30:00Z"), dispatch)).resolves.toMatchObject({ ok: true, idempotent: false, handoff: "dispatched", workerRequestId: "worker-job-1" });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ runId: "nio-2026-08-26", regionName: "North Indian Ocean" }));
  });

  it("does not dispatch a duplicate daily run", async () => {
    mocks.createOceanRunIfAbsent.mockResolvedValue({ created: false, runId: "nio-2026-08-26" });
    const dispatch = vi.fn();
    await expect(enqueueVercelDailyRefresh(new Date("2026-08-26T03:30:00Z"), dispatch)).resolves.toMatchObject({ ok: true, idempotent: true, handoff: "already-queued" });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
