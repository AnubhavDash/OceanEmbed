import type { ArtifactRef, OceanRun, QaTrace } from "../drizzle/schema";

type PersistedRun = Pick<OceanRun, "id" | "status" | "confidence" | "fallbackMode" | "completedAt" | "modelVersion" | "sourceManifestKey">;
type PersistedTrace = Pick<QaTrace, "id" | "action" | "state" | "rationale">;
type PersistedArtifact = Pick<ArtifactRef, "id" | "kind" | "publicUrl" | "sha256">;

export function summarizePersistedRun(run: PersistedRun, artifacts: PersistedArtifact[], traces: PersistedTrace[]) {
  const qaTrace = traces.sort((left, right) => right.id.localeCompare(left.id))[0];
  return {
    id: run.id,
    status: run.status,
    modelVersion: run.modelVersion,
    confidence: run.confidence,
    fallbackMode: run.fallbackMode,
    completedAt: run.completedAt,
    sourceManifestKey: run.sourceManifestKey,
    artifactCount: artifacts.length,
    immutableArtifactCount: artifacts.filter(artifact => Boolean(artifact.publicUrl) && artifact.sha256.length === 64).length,
    reviewRequired: run.fallbackMode === "human_review" || qaTrace?.action === "request_human_review",
    latestQa: qaTrace ? { id: qaTrace.id, state: qaTrace.state, action: qaTrace.action, rationale: qaTrace.rationale } : null,
  };
}
