import { describe, expect, it } from "vitest";
import { buildCuratedBaselineMaterialization } from "./materializeBaseline";

describe("curated baseline materialization", () => {
  it("always creates a review-gated run and pending alert without attempting owner delivery", () => {
    const value = buildCuratedBaselineMaterialization();
    expect(value.payload.reconstructionProfile).toHaveLength(15);
    expect(value.qaTrace.action).toBe("request_human_review");
    expect(value.pendingAlert.deliveryState).toBe("pending");
    expect(value.payload.qaSnapshot.maximumUncertaintyC).toBeGreaterThan(value.payload.qaSnapshot.guardrailC);
    expect(value.artifacts).toHaveLength(10);
    expect(value.artifacts.every(artifact => artifact.sha256.length === 64 && artifact.publicUrl.startsWith("/manus-storage/"))).toBe(true);
  });
});
