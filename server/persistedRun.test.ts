import { describe, expect, it } from "vitest";
import { summarizePersistedRun } from "./persistedRun";

describe("summarizePersistedRun", () => {
  it("keeps immutable evidence and an explicit human-review boundary visible", () => {
    const summary = summarizePersistedRun(
      { id: "run-1", status: "completed", modelVersion: "baseline", confidence: "limited", fallbackMode: "human_review", completedAt: new Date("2025-08-01T12:00:00Z"), sourceManifestKey: "/manus-storage/prediction.json" },
      [{ id: "artifact-1", kind: "evidence_snapshot", publicUrl: "/manus-storage/prediction.json", sha256: "a".repeat(64) }],
      [{ id: "trace-1", action: "request_human_review", state: "escalated", rationale: "Maximum residual uncertainty exceeded the policy threshold." }],
    );

    expect(summary.reviewRequired).toBe(true);
    expect(summary.immutableArtifactCount).toBe(1);
    expect(summary.latestQa?.action).toBe("request_human_review");
  });
});
