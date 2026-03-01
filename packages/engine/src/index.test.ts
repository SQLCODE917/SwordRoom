import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createHelloResponse, validateHelloRequest } from "./index.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_FIXTURE_PATH = resolve(
  HERE,
  "../../..",
  "fixtures/vertical-slice.character-creation.fixtures.yaml",
);

describe("engine hello utilities", () => {
  it("creates a hello response from shared engine type", () => {
    const result = createHelloResponse(
      { name: "Ada" },
      new Date("2024-01-01T00:00:00.000Z"),
    );
    expect(result).toEqual({
      message: "Hello, Ada!",
      source: "engine",
      timestamp: "2024-01-01T00:00:00.000Z",
    });
  });

  it("validates request input", () => {
    expect(validateHelloRequest({ name: "   " })).toEqual([
      { field: "name", message: "name is required" },
    ]);
    expect(validateHelloRequest({ name: "Grace" })).toEqual([]);
  });
});

describe("fixture-linked checks", () => {
  it("loads source-of-truth fixtures and checks required content for this slice", () => {
    const fixturesText = readFileSync(SOURCE_FIXTURE_PATH, "utf8");

    expect(fixturesText).toContain("doc_type: fixtures");
    expect(fixturesText).toContain("slice: character_creation_vertical_slice");
    expect(fixturesText).toContain(
      "- id: good.human_rune_master_sorcerer_starter",
    );
    expect(fixturesText).toContain('code: "SORCERER_SAGE_BUNDLE_REQUIRED"');
  });
});
