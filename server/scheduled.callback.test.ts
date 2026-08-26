import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getPipelineConfigByTaskUid: vi.fn(),
  createOceanRunIfAbsent: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({
  getPipelineConfigByTaskUid: mocks.getPipelineConfigByTaskUid,
  createOceanRunIfAbsent: mocks.createOceanRunIfAbsent,
}));

import { refreshNorthIndianOceanScene } from "./scheduled";
import { buildCuratedBaselineMaterialization } from "./materializeBaseline";

function responseStub() {
  const result: { statusCode?: number; body?: unknown } = {};
  const response = {
    status: (statusCode: number) => { result.statusCode = statusCode; return response; },
    json: (body: unknown) => { result.body = body; return response; },
  };
  return { response, result };
}

describe("authenticated scheduled refresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates only an idempotent queued run for a ready cron configuration", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    mocks.getPipelineConfigByTaskUid.mockResolvedValue({ enabled: 1, dataSourceStatus: "ready", modelEndpointStatus: "ready", regionName: "North Indian Ocean" });
    mocks.createOceanRunIfAbsent.mockResolvedValue({ created: false, runId: "nio-2026-08-25" });
    const { response, result } = responseStub();

    await refreshNorthIndianOceanScene({} as never, response as never);

    expect(mocks.createOceanRunIfAbsent).toHaveBeenCalledOnce();
    expect(result.body).toMatchObject({ ok: true, idempotent: true, runId: "nio-2026-08-25" });
  });

  it("keeps the evidence-linked threshold alert pending instead of delivering it during materialization", () => {
    const materialization = buildCuratedBaselineMaterialization();
    expect(materialization.pendingAlert.deliveryState).toBe("pending");
    expect(materialization.pendingAlert.evidenceArtifactId).toBe("artifact-baseline-prediction-2025");
    expect(materialization.pendingAlert.qaTraceId).toBe(materialization.qaTrace.id);
  });
});
