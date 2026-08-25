import { describe, expect, it } from "vitest";
import { evaluateRefreshGate } from "./scheduled";

describe("scheduled refresh gate", () => {
  it("keeps the refresh disabled until both approved source and endpoint are ready", () => {
    expect(evaluateRefreshGate(undefined)).toEqual({ allowed: false, reason: "orphan" });
    expect(evaluateRefreshGate({ enabled: 0, dataSourceStatus: "ready", modelEndpointStatus: "ready" })).toEqual({ allowed: false, reason: "pipeline-disabled" });
    expect(evaluateRefreshGate({ enabled: 1, dataSourceStatus: "ready", modelEndpointStatus: "unconfigured" })).toEqual({ allowed: false, reason: "pipeline-not-ready" });
  });

  it("allows a ready, enabled configuration to create an idempotent queued run", () => {
    expect(evaluateRefreshGate({ enabled: 1, dataSourceStatus: "ready", modelEndpointStatus: "ready" })).toEqual({ allowed: true, reason: "ready" });
  });
});
