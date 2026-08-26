import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("OceanEmbed signal desk accessibility contract", () => {
  it("keeps a semantic page heading and labels the profile and field evidence", () => {
    expect(source).toContain('<h1 className="sr-only">{title}</h1>');
    expect(source).toContain('aria-label="Temperature profile comparison"');
    expect(source).toContain('aria-label="Curated Bay of Bengal field"');
  });

  it("preserves visible keyboard focus and an opt-out for nonessential motion", () => {
    expect(styles).toContain("button:focus-visible,select:focus-visible,a:focus-visible");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
