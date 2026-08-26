export function canPromoteCurrentScene(status: "queued" | "processing" | "completed" | "degraded" | "failed") {
  return status === "completed" || status === "degraded";
}
