import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listContractRoutes } from "./index.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ASYNC_DOC_PATH = resolve(
  HERE,
  "../../../..",
  "docs/vertical-slice.character-creation.async-layer.yaml",
);

describe("services/api contract route map", () => {
  it("matches the vertical-slice async-layer endpoint contract", () => {
    const routes = listContractRoutes();
    expect(routes).toEqual([
      { method: "POST", path: "/commands", auth: "required" },
      { method: "GET", path: "/commands/{commandId}", auth: "required" },
      { method: "GET", path: "/me/inbox", auth: "required" },
      {
        method: "GET",
        path: "/games/{gameId}/characters/{characterId}",
        auth: "required",
      },
      { method: "GET", path: "/gm/{gameId}/inbox", auth: "gm_required" },
    ]);
  });

  it("source contract document contains every mapped route", () => {
    const asyncDoc = readFileSync(ASYNC_DOC_PATH, "utf8");
    for (const route of listContractRoutes()) {
      expect(asyncDoc).toContain(`method: ${route.method}`);
      expect(asyncDoc).toContain(`path: ${route.path}`);
    }
  });
});
