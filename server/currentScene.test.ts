import { describe, expect, it } from "vitest";
import { canPromoteCurrentScene } from "./currentScene";

describe("current-scene promotion", () => {
  it("only promotes terminal usable runs", () => {
    expect(canPromoteCurrentScene("queued")).toBe(false);
    expect(canPromoteCurrentScene("processing")).toBe(false);
    expect(canPromoteCurrentScene("failed")).toBe(false);
    expect(canPromoteCurrentScene("completed")).toBe(true);
    expect(canPromoteCurrentScene("degraded")).toBe(true);
  });
});
