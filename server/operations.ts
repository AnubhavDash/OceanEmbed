export type EvidenceAlertInput = {
  regionName: string;
  runId: string;
  risk: "watch" | "review" | "high" | "withhold";
  confidence: "high" | "moderate" | "limited" | "insufficient";
  oceanHeatContentKjCm2: number;
  uncertaintyC: number;
  evidenceUrl: string;
  qaTraceUrl: string;
};

export function buildOwnerThresholdAlert(input: EvidenceAlertInput) {
  const title = `OceanEmbed ${input.risk.toUpperCase()} · ${input.regionName}`;
  const content = [
    `Run: ${input.runId}`,
    `Decision-support risk: ${input.risk}; confidence: ${input.confidence}.`,
    `Ocean heat content: ${input.oceanHeatContentKjCm2.toFixed(1)} kJ/cm²; profile uncertainty: ${input.uncertaintyC.toFixed(2)}°C.`,
    `Evidence: ${input.evidenceUrl}`,
    `QA trace: ${input.qaTraceUrl}`,
    "This notification is a review prompt, not a cyclone forecast or public warning.",
  ].join("\n");
  return { title, content };
}

export function getDailyRunId(asOf: Date): string {
  return `nio-${asOf.toISOString().slice(0, 10)}`;
}
