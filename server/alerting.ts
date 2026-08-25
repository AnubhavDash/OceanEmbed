import { randomUUID } from "node:crypto";
import { recordThresholdAlert } from "./db";
import { buildOwnerThresholdAlert, EvidenceAlertInput } from "./operations";
import { notifyOwner } from "./_core/notification";

/** Sends a project-owner alert only after the run has linked both evidence and QA records. */
export async function notifyOwnerWithEvidence(input: EvidenceAlertInput & {
  monitoredRegionId: string;
  evidenceArtifactId: string;
  qaTraceId: string;
}) {
  const payload = buildOwnerThresholdAlert(input);
  const delivered = await notifyOwner(payload);
  await recordThresholdAlert({
    id: randomUUID(),
    runId: input.runId,
    monitoredRegionId: input.monitoredRegionId,
    type: input.risk === "high" ? "combined" : "heat_fuel",
    severity: input.risk === "high" ? "high" : input.risk === "review" ? "review" : "watch",
    evidenceArtifactId: input.evidenceArtifactId,
    qaTraceId: input.qaTraceId,
    deliveryState: delivered ? "delivered" : "failed",
    deliveredAt: delivered ? new Date() : null,
  });
  return { delivered, payload };
}
