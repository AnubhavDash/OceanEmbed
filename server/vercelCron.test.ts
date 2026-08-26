import { describe, expect, it } from "vitest";
import { isVercelCronAuthorized } from "./vercelCron";

describe("Vercel cron authorization", () => {
  it("accepts only the exact configured bearer secret", () => {
    expect(isVercelCronAuthorized("Bearer intended-secret", "intended-secret")).toBe(true);
    expect(isVercelCronAuthorized("Bearer wrong-secret", "intended-secret")).toBe(false);
    expect(isVercelCronAuthorized(undefined, "intended-secret")).toBe(false);
    expect(isVercelCronAuthorized("Bearer intended-secret", undefined)).toBe(false);
  });
});
