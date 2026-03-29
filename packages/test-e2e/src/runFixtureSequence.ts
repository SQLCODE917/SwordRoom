import { randomUUID } from 'node:crypto';
import { loadVerticalSliceFixtures } from '@starter/shared';

const sequenceId = process.argv[2];
if (!sequenceId) {
  throw new Error('usage: runFixtureSequence <sequenceId>');
}

const baseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.API_PORT ?? '3000'}`;
const authMode = process.env.AUTH_MODE ?? 'dev';

async function main(): Promise<void> {
  const fixtures = loadVerticalSliceFixtures() as Record<string, any>;
  const sequence = (fixtures.command_sequences_for_integration as Array<Record<string, any>>).find(
    (item) => item.id === sequenceId
  );

  if (!sequence) {
    throw new Error(`sequence not found: ${sequenceId}`);
  }

  const commands = (sequence.commands ?? []) as Array<Record<string, any>>;

  for (let i = 0; i < commands.length; i += 1) {
    const cmd = commands[i]!;
    const commandId = randomUUID();
    const actorId = cmd.type === 'GMReviewCharacter' ? 'gm-zzz' : 'player-aaa';

    const postResponse = await postCommand({
      commandId,
      gameId: 'game-1',
      type: cmd.type,
      schemaVersion: 1,
      createdAt: new Date(Date.now() + i * 1000).toISOString(),
      payload: cmd.payload,
      actorId,
    });

    if (!postResponse.accepted) {
      throw new Error(`POST /commands not accepted for ${cmd.type}`);
    }

    const commandStatus = await pollCommandStatus(commandId, 30_000);
    if (commandStatus.status !== 'PROCESSED') {
      throw new Error(
        `command ${cmd.type} failed: status=${commandStatus.status} errorCode=${commandStatus.errorCode} errorMessage=${commandStatus.errorMessage}`
      );
    }
  }

  const character = await getJson(`/games/game-1/characters/char-human-1`);
  if (character.status !== 'APPROVED') {
    throw new Error(`expected char-human-1 APPROVED, got ${character.status}`);
  }

  const gmInbox = await getJson('/gm/game-1/inbox');
  if (!Array.isArray(gmInbox) || gmInbox.length !== 0) {
    throw new Error('expected GM inbox pending item to be resolved');
  }

  const playerInbox = await getJson('/me/inbox', {
    actorId: 'player-aaa',
  });

  const hasApproved = Array.isArray(playerInbox) && playerInbox.some((item) => item.kind === 'CHAR_APPROVED');
  if (!hasApproved) {
    throw new Error('expected player inbox to contain CHAR_APPROVED');
  }

  // eslint-disable-next-line no-console
  console.log(`Sequence ${sequenceId} passed.`);
}

interface PostCommandInput {
  commandId: string;
  gameId: string;
  type: string;
  schemaVersion: number;
  createdAt: string;
  payload: Record<string, unknown>;
  actorId: string;
}

async function postCommand(input: PostCommandInput): Promise<{ accepted: boolean }> {
  const headers = authHeaders(input.actorId);
  const response = await fetch(`${baseUrl}/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      envelope: {
        commandId: input.commandId,
        gameId: input.gameId,
        type: input.type,
        schemaVersion: input.schemaVersion,
        createdAt: input.createdAt,
        payload: input.payload,
      },
      bypassActorId: authMode === 'dev' ? input.actorId : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`POST /commands failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as { accepted: boolean };
}

async function pollCommandStatus(
  commandId: string,
  timeoutMs: number
): Promise<{ status: string; errorCode?: string; errorMessage?: string }> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await getJson(`/commands/${encodeURIComponent(commandId)}`);
    if (status.status === 'PROCESSED' || status.status === 'FAILED') {
      return status;
    }
    await sleep(500);
  }

  throw new Error(`command ${commandId} did not reach terminal state within ${timeoutMs}ms`);
}

async function getJson(path: string, options?: { actorId?: string }): Promise<any> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authHeaders(options?.actorId),
  });

  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function authHeaders(actorId?: string): Record<string, string> {
  if (authMode === 'oidc') {
    const token = actorId === 'gm-zzz' ? process.env.OIDC_TEST_GM_TOKEN : process.env.OIDC_TEST_PLAYER_TOKEN;
    if (!token) {
      throw new Error('missing OIDC test token env var for auth mode oidc');
    }
    return { authorization: `Bearer ${token}` };
  }

  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main();
