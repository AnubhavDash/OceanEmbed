import { createHash, randomUUID } from "node:crypto";
import { recordArtifactRef } from "./db";
import { storagePut } from "./storage";

export type ArtifactKind = "source_subset" | "opencv_layer" | "model_artifact" | "validation_extract" | "reproducibility_bundle" | "evidence_snapshot";

/** Stores bytes outside the database and records only immutable metadata and the storage reference. */
export async function persistRunArtifact(input: {
  runId: string;
  kind: ArtifactKind;
  filename: string;
  data: Buffer | Uint8Array | string;
  contentType: string;
  provenance: Record<string, unknown>;
}) {
  const bytes = typeof input.data === "string" ? Buffer.from(input.data) : Buffer.from(input.data);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const stored = await storagePut(`oceanembed/runs/${input.runId}/${input.kind}/${input.filename}`, bytes, input.contentType);
  const id = randomUUID();
  await recordArtifactRef({
    id,
    runId: input.runId,
    kind: input.kind,
    objectKey: stored.key,
    publicUrl: stored.url,
    sha256,
    contentType: input.contentType,
    byteSize: bytes.byteLength,
    provenance: input.provenance,
  });
  return { id, ...stored, sha256 };
}
