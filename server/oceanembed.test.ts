import { describe, expect, it } from "vitest";
import { ProfilePoint, deriveHeatFuelDecision, estimate26CIsothermDepth, estimateOceanHeatContent, recommendQaAction } from "../shared/oceanembed";

const profile: ProfilePoint[] = [
  { depthM: 0, temperatureC: 29, uncertaintyC: 0.2, climatologyC: 28.8 },
  { depthM: 50, temperatureC: 27, uncertaintyC: 0.4, climatologyC: 26.8 },
  { depthM: 100, temperatureC: 25, uncertaintyC: 0.7, climatologyC: 24.9 },
];

describe("OceanEmbed decision domain", () => {
  it("interpolates the 26°C isotherm and computes positive heat content", () => {
    expect(estimate26CIsothermDepth(profile)).toBe(75);
    expect(estimateOceanHeatContent(profile)).toBeGreaterThan(0);
  });

  it("withholds an automated heat-fuel classification when confidence is insufficient", () => {
    const decision = deriveHeatFuelDecision(profile.map(point => ({ ...point, uncertaintyC: 1.8 })), 0.5);
    expect(decision.confidence).toBe("insufficient");
    expect(decision.risk).toBe("withhold");
    expect(decision.fallbackMode).toBe("full_climatology");
  });

  it("uses OpenCV evidence thresholds to select a conservative QA action", () => {
    expect(recommendQaAction(0.5, 0.8, 0.9)).toBe("reprocess_inpainting");
    expect(recommendQaAction(0.1, 1.7, 0.9)).toBe("selective_climatology");
    expect(recommendQaAction(0.1, 0.7, 0.9)).toBe("accept_scene");
  });
});
