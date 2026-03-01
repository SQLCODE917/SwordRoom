import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type CommandType =
  | "CreateCharacterDraft"
  | "SetCharacterSubAbilities"
  | "ApplyStartingPackage"
  | "SpendStartingExp"
  | "PurchaseStarterEquipment"
  | "SubmitCharacterForApproval"
  | "GMReviewCharacter";

export interface CommandEnvelope {
  commandId: string;
  gameId: string;
  actorId: string;
  type: CommandType;
  schemaVersion: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AppError {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}

export const dbKeys = {
  commandLogPk: (gameId: string, commandId: string) =>
    `GAME#${gameId}#CMD#${commandId}`,
  characterPk: (gameId: string, characterId: string) =>
    `GAME#${gameId}#CHAR#${characterId}`,
  inboxPk: (gameId: string, actorId: string) =>
    `GAME#${gameId}#INBOX#${actorId}`,
} as const;

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_FIXTURE_PATH = resolve(
  HERE,
  "../../../..",
  "fixtures/vertical-slice.character-creation.fixtures.yaml",
);

export function loadVerticalSliceFixturesText(): string {
  return readFileSync(SOURCE_FIXTURE_PATH, "utf8");
}
