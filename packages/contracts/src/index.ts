export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  dependencies: Record<string, "ok" | "error">;
}
