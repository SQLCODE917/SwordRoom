import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listRegisteredCommandTypes } from "./index.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ASYNC_DOC_PATH = resolve(
  HERE,
  "../../../..",
  "docs/vertical-slice.character-creation.async-layer.yaml",
);

describe("services/dispatcher command registry", () => {
  it("registers only command types defined by async-layer contract", () => {
    expect(listRegisteredCommandTypes()).toEqual([
      "CreateCharacterDraft",
      "SetCharacterSubAbilities",
      "ApplyStartingPackage",
      "SpendStartingExp",
      "PurchaseStarterEquipment",
      "SubmitCharacterForApproval",
      "GMReviewCharacter",
    ]);
  });

  it("verifies command types exist in source contract text", () => {
    const asyncDoc = readFileSync(ASYNC_DOC_PATH, "utf8");
    for (const type of listRegisteredCommandTypes()) {
      expect(asyncDoc).toContain(`type: ${type}`);
    }
  });
});
