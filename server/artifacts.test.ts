import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

describe("Artifact integrity convention", () => {
  it("produces a stable SHA-256 digest for an immutable artifact payload", () => {
    const digest = createHash("sha256").update(Buffer.from("oceanembed-evidence")).digest("hex");
    expect(digest).toHaveLength(64);
    expect(digest).toBe(createHash("sha256").update(Buffer.from("oceanembed-evidence")).digest("hex"));
  });
});
