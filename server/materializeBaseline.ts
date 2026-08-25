import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { artifactRefs, monitoredRegions, oceanRunPayloads, oceanRuns, qaTraces, thresholdAlerts } from "../drizzle/schema";

const RUN_ID = "baseline-nio-2025-08-01-argo-location";

const reconstructionProfile = [[0, 29.006], [10, 29.026], [20, 29.005], [30, 28.958], [50, 27.866], [75, 25.344], [100, 21.844], [125, 18.119], [150, 16.306], [200, 13.633], [300, 11.48], [500, 9.765], [700, 8.44], [850, 7.515], [1000, 6.651]].map(([depthM, temperatureC]) => ({ depthM, temperatureC }));
const uncertaintyProfile = [[0, 0.233], [10, 0.21], [20, 0.191], [30, 0.18], [50, 0.466], [75, 0.64], [100, 0.674], [125, 0.715], [150, 0.394], [200, 0.281], [300, 0.115], [500, 0.067], [700, 6.657], [850, 0.054], [1000, 0.053]].map(([depthM, uncertaintyC]) => ({ depthM, uncertaintyC }));
const observedProfile = [[0, 29.771], [10, 29.6545], [20, 29.4715], [30, 29.3815], [50, 29.1484], [75, 26.3901], [100, 23.1504], [125, 20.0726], [150, 18.0776], [200, 14.6951], [300, 12.0872], [500, 10.2377], [700, 8.6585], [850, 7.7602], [1000, 6.8919]].map(([depthM, temperatureC]) => ({ depthM, temperatureC }));

const immutableArtifacts = [
  { id: "artifact-raw-oisst-2025", kind: "source_subset" as const, objectKey: "oisst-avhrr-v02r01.20250801_d0f5410b.nc", publicUrl: "/manus-storage/oisst-avhrr-v02r01.20250801_d0f5410b.nc", sha256: "787e9a173716aeaebca364a010cd321e5de6305220f7626c835d3362c3768ea9", contentType: "application/x-netcdf", byteSize: 1559833, provenance: { label: "Raw NOAA OISST source subset", source: "NOAA OISST v2.1", date: "2025-08-01" } },
  { id: "artifact-raw-argo-2025", kind: "validation_extract" as const, objectKey: "argo_probe_5929d802.csv", publicUrl: "/manus-storage/argo_probe_5929d802.csv", sha256: "caf30cbce1f9f51f6b30802b2cad47b456c5af2b1a2916894b9e4d68a6c7c0bf", contentType: "text/csv", byteSize: 7338, provenance: { label: "Held-out NOAA ERDDAP Argo extract", role: "illustrative", usedForTraining: false } },
  { id: "artifact-curated-manifest-2025", kind: "reproducibility_bundle" as const, objectKey: "curated_scene_0b5ec51d.json", publicUrl: "/manus-storage/curated_scene_0b5ec51d.json", sha256: "b4ff1471fd8de6496e0dd77495b0717c5086dfb52f345a24b28818c8240224bf", contentType: "application/json", byteSize: 6926, provenance: { label: "Curated source manifest", opencvVersion: "5.0.0" } },
  { id: "artifact-opencv-mask-2025", kind: "opencv_layer" as const, objectKey: "oisst_valid_mask_3e0847f4.png", publicUrl: "/manus-storage/oisst_valid_mask_3e0847f4.png", sha256: "807baebcbec13a92b18ce7666fec815ec7a02068ff44589b544eae24ffc1fd8c", contentType: "image/png", byteSize: 178, provenance: { label: "Actual OISST valid-data mask", operation: "finite-data mask" } },
  { id: "artifact-opencv-inpaint-2025", kind: "opencv_layer" as const, objectKey: "oisst_inpainted_c99f9ec5.png", publicUrl: "/manus-storage/oisst_inpainted_c99f9ec5.png", sha256: "712b2d3b479447eeeda553e1bf5036e9d60f595526a14368794c46f3b9e905e1", contentType: "image/png", byteSize: 4073, provenance: { label: "Actual Navier-Stokes inpaint", operation: "cv.inpaint Navier-Stokes" } },
  { id: "artifact-opencv-fronts-2025", kind: "opencv_layer" as const, objectKey: "oisst_sobel_fronts_613a2562.png", publicUrl: "/manus-storage/oisst_sobel_fronts_613a2562.png", sha256: "536beab3af59c0d922a4ba1a71e01bb452b8a90c5e9c277f8f4c101243e3cd41", contentType: "image/png", byteSize: 4537, provenance: { label: "Actual Sobel SST fronts", operation: "Sobel gradient" } },
  { id: "artifact-opencv-tiles-2025", kind: "opencv_layer" as const, objectKey: "oisst_tile_coverage_4f2a1f5e.png", publicUrl: "/manus-storage/oisst_tile_coverage_4f2a1f5e.png", sha256: "9c94187ee4b159499663a1e6c44bbb56af09e9360e3841363215c71b8f0df483", contentType: "image/png", byteSize: 13415, provenance: { label: "Actual 4x4 tile coverage", operation: "tile availability" } },
  { id: "artifact-baseline-model-2025", kind: "model_artifact" as const, objectKey: "baseline_model_153941c5.json", publicUrl: "/manus-storage/baseline_model_153941c5.json", sha256: "ae652a52d2d80e5e2d3edb619584451c579fb74d1ce0779c46f8cb7bbef3ab99", contentType: "application/json", byteSize: 6120, provenance: { label: "Public baseline model", trainSamples: 43, validationSamples: 21, testSamples: 7 } },
  { id: "artifact-baseline-report-2025", kind: "validation_extract" as const, objectKey: "baseline_report_e5dbd396.json", publicUrl: "/manus-storage/baseline_report_e5dbd396.json", sha256: "6ea51349917e6ef4f42fa7f0370b0eee6f5fbd507667089313dbd9d5bedcb8f1", contentType: "application/json", byteSize: 6929, provenance: { label: "Chronological baseline evaluation", testRmseC: 0.86957 } },
  { id: "artifact-baseline-prediction-2025", kind: "evidence_snapshot" as const, objectKey: "curated_baseline_prediction_2a7ccd98.json", publicUrl: "/manus-storage/curated_baseline_prediction_2a7ccd98.json", sha256: "4f00c8732d411e89b7a1c64901d9983b461da79410603914f56c32121cc4a109", contentType: "application/json", byteSize: 2747, provenance: { label: "Curated baseline prediction", maximumUncertaintyC: 6.657 } },
];

export function buildCuratedBaselineMaterialization() {
  const maximumUncertaintyC = 6.657;
  const guardrailC = 1.5;
  return {
    run: {
      id: RUN_ID, status: "completed" as const, asOf: new Date("2025-08-01T12:00:00Z"), regionName: "Bay of Bengal", sourceManifestKey: "/manus-storage/curated_baseline_prediction_2a7ccd98.json", datasetVersion: "NOAA OISST v2.1; NOAA ERDDAP Argo; HYCOM ESPC-D-V02", modelVersion: "oceanembed-public-climatology-residual-baseline", codeVersion: "curated-baseline-2025-08-01", confidence: "limited" as const, fallbackMode: "human_review" as const, completedAt: new Date("2026-08-25T18:32:13Z"),
    },
    payload: {
      id: "payload-baseline-2025-001", runId: RUN_ID, reconstructionProfile, uncertaintyProfile,
      decision: { isotherm26DepthM: 68.4999, oceanHeatContentKjCm2: 66.0474, mixedLayerProxyM: 50, medianUncertaintyC: 0.2328, maximumUncertaintyC, confidence: "limited", risk: "review", fallbackMode: "human_review", rationale: "Public-data climatology-residual baseline with per-depth uncertainty calibrated from chronological validation residuals. It is a comparison baseline, not an operational forecast." },
      validationSummary: { floatId: "NOAA-ERDDAP-ARGO-2025-08-01", observedAt: "2025-08-01T14:21:47Z", latitude: 12.933333, longitude: 89.816667, overallRmseC: 0.9888, overallBiasC: -0.8327, note: "Argo was excluded from training, tuning, and uncertainty calibration; one profile is illustrative only.", observedProfile, depthBands: [{ band: "0-30 m", sampleCount: 4, rmseC: 0.5868, biasC: -0.5709, correlation: 0.7124 }, { band: "50-200 m", sampleCount: 6, rmseC: 1.4452, biasC: -1.4038, correlation: 0.9978 }, { band: "300-1000 m", sampleCount: 5, rmseC: 0.3892, biasC: -0.3568, correlation: 0.9995 }] },
      qaSnapshot: { traceId: "qa-baseline-2025-001", action: "request_human_review", state: "escalated", guardrailC, maximumUncertaintyC, evidenceUrl: "/manus-storage/curated_baseline_prediction_2a7ccd98.json", rationale: "Maximum calibrated residual uncertainty exceeds the autonomous-decision threshold." },
      display: { notice: "Curated historical inference · 1 Aug 2025 · NOAA OISST drives an evaluated public-data climatology-residual baseline. NOAA ERDDAP Argo is held out for illustration; OpenCV 5.0.0 processed the source field. This is not live data or a production forecast.", validCoverage: 0.8525, cloudCoverageLabel: "Unavailable: OISST is an analysed SST product; the finite-data mask is not a satellite cloud classification.", frontMeanMagnitude: 69.8864, tileCoverage: 0.79125, layers: { Temperature: "/manus-storage/oisst_sst_9ce6f15e.png", Uncertainty: "/manus-storage/oisst_valid_mask_3e0847f4.png", "Cloud cover": "/manus-storage/oisst_valid_mask_3e0847f4.png", "SST fronts": "/manus-storage/oisst_sobel_fronts_613a2562.png", "26°C depth": "/manus-storage/oisst_sst_9ce6f15e.png" }, artifacts: immutableArtifacts.map(({ id, kind, publicUrl, provenance }) => ({ id, kind, href: publicUrl, label: provenance.label })) },
    },
    qaTrace: { id: "qa-baseline-2025-001", runId: RUN_ID, sequence: 1, triggerType: "uncertainty_cluster" as const, action: "request_human_review" as const, rationale: "The maximum chronological-validation residual uncertainty is 6.657°C at 700 m, exceeding the 1.5°C autonomous-decision guardrail.", evidence: { opencvVersion: "5.0.0", baselineReport: "/manus-storage/baseline_report_e5dbd396.json" }, beforeMetrics: { maximumUncertaintyC, cloudClassification: "not_available_for_analysed_oisst" }, afterMetrics: { fallbackMode: "human_review", decisionState: "review" }, state: "escalated" as const },
    pendingAlert: { id: "alert-baseline-2025-001", runId: RUN_ID, monitoredRegionId: "region-bay-bengal-2025", type: "uncertainty" as const, severity: "review" as const, evidenceArtifactId: "artifact-baseline-prediction-2025", qaTraceId: "qa-baseline-2025-001", deliveryState: "pending" as const },
    artifacts: immutableArtifacts,
  };
}

/** Persists the real curated baseline atomically; notification delivery remains deliberately unattempted. */
export async function materializeCuratedBaseline() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; curated baseline cannot be materialized.");
  const materialization = buildCuratedBaselineMaterialization();
  await db.transaction(async tx => {
    await tx.insert(monitoredRegions).values({ id: "region-bay-bengal-2025", name: "Bay of Bengal curated monitoring region", bounds: { north: 20, south: 10, east: 90, west: 80 }, heatFuelThreshold: "70.0", uncertaintyThreshold: "1.5", active: 1 }).onDuplicateKeyUpdate({ set: { heatFuelThreshold: "70.0", uncertaintyThreshold: "1.5", active: 1 } });
    await tx.insert(oceanRuns).values(materialization.run).onDuplicateKeyUpdate({ set: { status: materialization.run.status, modelVersion: materialization.run.modelVersion, confidence: materialization.run.confidence, fallbackMode: materialization.run.fallbackMode, completedAt: materialization.run.completedAt } });
    await tx.insert(artifactRefs).values(materialization.artifacts.map(artifact => ({ ...artifact, runId: RUN_ID }))).onDuplicateKeyUpdate({ set: { id: sql`id` } });
    await tx.insert(oceanRunPayloads).values(materialization.payload).onDuplicateKeyUpdate({ set: { reconstructionProfile: materialization.payload.reconstructionProfile, uncertaintyProfile: materialization.payload.uncertaintyProfile, decision: materialization.payload.decision, validationSummary: materialization.payload.validationSummary, qaSnapshot: materialization.payload.qaSnapshot, display: materialization.payload.display } });
    await tx.insert(qaTraces).values(materialization.qaTrace).onDuplicateKeyUpdate({ set: { rationale: materialization.qaTrace.rationale, evidence: materialization.qaTrace.evidence, beforeMetrics: materialization.qaTrace.beforeMetrics, afterMetrics: materialization.qaTrace.afterMetrics, state: materialization.qaTrace.state } });
    await tx.insert(thresholdAlerts).values(materialization.pendingAlert).onDuplicateKeyUpdate({ set: { severity: materialization.pendingAlert.severity, evidenceArtifactId: materialization.pendingAlert.evidenceArtifactId, qaTraceId: materialization.pendingAlert.qaTraceId, deliveryState: "pending" } });
  });
  return { runId: materialization.run.id, qaTraceId: materialization.qaTrace.id, alertId: materialization.pendingAlert.id, notificationDelivery: "not_attempted" as const };
}
