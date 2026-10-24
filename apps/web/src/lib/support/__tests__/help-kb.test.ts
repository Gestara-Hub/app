import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("índice da central de ajuda", () => {
  it("está em dia com docs/ajuda (rode pnpm --filter @gestarahub/web help:build se falhar)", () => {
    const script = fileURLToPath(new URL("../../../../scripts/build-help-kb.mjs", import.meta.url));
    expect(() => execFileSync("node", [script, "--check"], { stdio: "pipe" })).not.toThrow();
  });
});
