import { describe, expect, it } from "vitest";
import { buildOwnerThresholdAlert, getDailyRunId } from "./operations";

describe("OceanEmbed operations utilities", () => {
  it("creates stable daily run IDs for idempotent scheduled execution", () => {
    expect(getDailyRunId(new Date("2026-08-25T23:59:59Z"))).toBe("nio-2026-08-25");
  });

  it("includes evidence and QA links in every owner threshold alert", () => {
    const alert = buildOwnerThresholdAlert({
      regionName: "Bay of Bengal", runId: "nio-2026-08-25", risk: "review", confidence: "limited",
      oceanHeatContentKjCm2: 61.2, uncertaintyC: 1.1, evidenceUrl: "https://example.test/evidence", qaTraceUrl: "https://example.test/qa",
    });
    expect(alert.title).toContain("REVIEW");
    expect(alert.content).toContain("https://example.test/evidence");
    expect(alert.content).toContain("https://example.test/qa");
    expect(alert.content).toContain("not a cyclone forecast");
  });
});
