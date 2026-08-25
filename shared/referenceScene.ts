import { DEPTH_LEVELS_M, ProfilePoint, deriveHeatFuelDecision, recommendQaAction } from "./oceanembed";

export const REFERENCE_SCENE_NOTICE = "Reference interface scenario only — no live operational data are connected. Do not use this view for forecasts or public warnings.";

const profile: ProfilePoint[] = DEPTH_LEVELS_M.map((depthM, index) => {
  const temperatures = [29.4, 29.2, 28.9, 28.5, 27.9, 27.0, 26.3, 25.8, 25.2, 23.8, 19.4, 12.1, 8.1, 6.1, 4.5];
  const uncertainty = [0.24, 0.25, 0.28, 0.34, 0.43, 0.52, 0.61, 0.67, 0.73, 0.82, 0.97, 1.12, 1.21, 1.28, 1.34];
  const climatology = [29.1, 28.9, 28.5, 28.1, 27.4, 26.6, 25.7, 25.1, 24.3, 22.9, 18.8, 11.8, 8.0, 6.0, 4.5];
  return { depthM, temperatureC: temperatures[index], uncertaintyC: uncertainty[index], climatologyC: climatology[index] };
});

const observed = profile.map((point, index) => ({ ...point, temperatureC: Number((point.temperatureC + [0.1, -0.05, 0.08, -0.1, 0.03, 0.1, -0.08, 0.11, -0.06, 0.05, -0.12, 0.15, 0.03, -0.05, 0.04][index]).toFixed(2)) }));

export const REFERENCE_SCENE = {
  notice: REFERENCE_SCENE_NOTICE,
  run: { id: "ref-nio-2026-08-25T0000Z", asOf: "2026-08-25T00:00:00.000Z", region: "North Indian Ocean · Bay of Bengal focus", modelVersion: "oceanembed-residual-v0.1-reference", sourceManifest: "s3://oceanembed/reference/scenes/ref-nio-2026-08-25/manifest.json", status: "Reference scenario", coverageFraction: 0.78 },
  decision: deriveHeatFuelDecision(profile, 0.78),
  profile,
  validation: { floatId: "ARGO reference collocation", observedAt: "2026-08-25T06:00:00.000Z", predicted: profile, observed, metrics: [{ band: "0–30 m", rmse: 0.12, bias: 0.01, correlation: 0.99, baselineRmse: 0.68 }, { band: "50–200 m", rmse: 0.19, bias: 0.02, correlation: 0.97, baselineRmse: 1.18 }, { band: "300–1000 m", rmse: 0.09, bias: 0.01, correlation: 0.98, baselineRmse: 0.42 }] },
  preprocessing: { validCoverage: 0.78, cloudCoverage: 0.22, inpaintingRadiusPx: 5, frontContinuity: 0.82, tileCoverage: 0.91, qualityBefore: { frontPreservation: 0.64, validArea: 0.78 }, qualityAfter: { frontPreservation: 0.82, validArea: 0.96 } },
  qa: { action: recommendQaAction(0.22, 1.34, 0.82), traces: [{ id: "qa-ref-001", state: "detected", timestamp: "00:02:18Z", evidence: "OpenCV cloud mask identified a 22% occluded field; Sobel front continuity remained 0.82.", decision: "No broad reprocessing required; preserve native reconstruction where evidence is adequate.", before: "Cloud coverage 22% · valid tiles 91%", after: "Confidence Moderate · no fallback applied" }, { id: "qa-ref-002", state: "accepted", timestamp: "00:02:23Z", evidence: "Maximum profile uncertainty 1.34°C is below the full-fallback guardrail.", decision: "Accept with explicit decision-support limitations and retained evidence links.", before: "No action", after: "Trace persisted · review path available" }] },
  artifacts: [{ label: "Source manifest", type: "JSON", href: "s3://oceanembed/reference/scenes/ref-nio-2026-08-25/manifest.json" }, { label: "OpenCV QA bundle", type: "Zarr", href: "s3://oceanembed/reference/scenes/ref-nio-2026-08-25/opencv-layers.zarr" }, { label: "Validation extract", type: "NetCDF", href: "s3://oceanembed/reference/scenes/ref-nio-2026-08-25/argo-collocations.nc" }],
};
