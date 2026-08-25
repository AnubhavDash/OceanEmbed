export const DEPTH_LEVELS_M = [0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 850, 1000] as const;

export type ConfidenceLevel = "high" | "moderate" | "limited" | "insufficient";
export type FallbackMode = "none" | "selective_climatology" | "full_climatology" | "human_review";
export type QaAction = "reprocess_inpainting" | "selective_climatology" | "request_human_review" | "accept_scene";

export type ProfilePoint = {
  depthM: number;
  temperatureC: number;
  uncertaintyC: number;
  climatologyC: number;
};

export type HeatFuelDecision = {
  isotherm26DepthM: number | null;
  oceanHeatContentKjCm2: number;
  mixedLayerProxyM: number | null;
  confidence: ConfidenceLevel;
  fallbackMode: FallbackMode;
  risk: "watch" | "review" | "high" | "withhold";
  rationale: string;
};

const WATER_DENSITY_KG_M3 = 1025;
const SEAWATER_HEAT_CAPACITY_J_KG_K = 3990;

export function estimate26CIsothermDepth(profile: ProfilePoint[]): number | null {
  if (profile.length < 2 || profile[0].temperatureC < 26) return null;
  for (let i = 1; i < profile.length; i += 1) {
    const upper = profile[i - 1];
    const lower = profile[i];
    if (upper.temperatureC >= 26 && lower.temperatureC <= 26) {
      const deltaT = upper.temperatureC - lower.temperatureC;
      if (deltaT === 0) return lower.depthM;
      const fraction = (upper.temperatureC - 26) / deltaT;
      return upper.depthM + (lower.depthM - upper.depthM) * fraction;
    }
  }
  return null;
}

export function estimateOceanHeatContent(profile: ProfilePoint[]): number {
  if (profile.length < 2) return 0;
  let joulesPerSquareMeter = 0;
  for (let i = 1; i < profile.length; i += 1) {
    const upper = profile[i - 1];
    const lower = profile[i];
    const upperExcess = Math.max(upper.temperatureC - 26, 0);
    const lowerExcess = Math.max(lower.temperatureC - 26, 0);
    const dz = lower.depthM - upper.depthM;
    joulesPerSquareMeter += WATER_DENSITY_KG_M3 * SEAWATER_HEAT_CAPACITY_J_KG_K * ((upperExcess + lowerExcess) / 2) * dz;
  }
  return joulesPerSquareMeter / 10_000;
}

export function estimateMixedLayerProxy(profile: ProfilePoint[]): number | null {
  if (profile.length < 2) return null;
  const surfaceTemperature = profile[0].temperatureC;
  const threshold = surfaceTemperature - 0.5;
  const transition = profile.find(point => point.depthM > 0 && point.temperatureC <= threshold);
  return transition?.depthM ?? null;
}

export function classifyConfidence(coverageFraction: number, medianUncertaintyC: number): ConfidenceLevel {
  if (coverageFraction < 0.55 || medianUncertaintyC > 1.5) return "insufficient";
  if (coverageFraction < 0.7 || medianUncertaintyC > 1.0) return "limited";
  if (coverageFraction < 0.85 || medianUncertaintyC > 0.65) return "moderate";
  return "high";
}

export function deriveHeatFuelDecision(profile: ProfilePoint[], coverageFraction: number): HeatFuelDecision {
  const medianUncertainty = [...profile].sort((a, b) => a.uncertaintyC - b.uncertaintyC)[Math.floor(profile.length / 2)]?.uncertaintyC ?? 9;
  const confidence = classifyConfidence(coverageFraction, medianUncertainty);
  const z26 = estimate26CIsothermDepth(profile);
  const oceanHeatContentKjCm2 = estimateOceanHeatContent(profile);
  const mixedLayerProxyM = estimateMixedLayerProxy(profile);
  const fallbackMode: FallbackMode = confidence === "insufficient" ? "full_climatology" : confidence === "limited" ? "selective_climatology" : "none";

  if (confidence === "insufficient") {
    return { isotherm26DepthM: z26, oceanHeatContentKjCm2, mixedLayerProxyM, confidence, fallbackMode, risk: "withhold", rationale: "Coverage and reconstruction uncertainty do not support an automated heat-fuel classification; use climatology only and request review." };
  }

  const risk = oceanHeatContentKjCm2 >= 75 && (z26 ?? 0) >= 60 ? "high" : oceanHeatContentKjCm2 >= 50 ? "review" : "watch";
  return {
    isotherm26DepthM: z26,
    oceanHeatContentKjCm2,
    mixedLayerProxyM,
    confidence,
    fallbackMode,
    risk,
    rationale: confidence === "limited"
      ? "Use the reconstructed profile selectively; cloud-driven uncertainty invokes a climatology fallback outside valid tiles."
      : "The profile passes coverage and uncertainty guardrails; it remains decision support, not an intensity forecast.",
  };
}

export function recommendQaAction(cloudFraction: number, maxUncertaintyC: number, frontContinuity: number): QaAction {
  if (cloudFraction > 0.45 || frontContinuity < 0.45) return "reprocess_inpainting";
  if (maxUncertaintyC > 1.5) return "selective_climatology";
  if (maxUncertaintyC > 1.15) return "request_human_review";
  return "accept_scene";
}
