import { createServer } from 'node:http';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import {
  assertActorHasRole,
  assertCharacterOwnerOrGameMaster,
  assertGameMasterActor,
  logServiceFlow,
  summarizeCommandEnvelope,
  summarizeError,
} from '@starter/services-shared';
import { createApiAwsClients } from './awsClients.js';
import { createApiService } from './index.js';
import { resolveActorId } from './auth.js';

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
const deps = createApiAwsClients();
const service = createApiService({
  db: deps.db,
  uploads: deps.uploads,
  queue: deps.queue,
  queueUrl: deps.queueUrl,
  jwtBypass: process.env.AUTH_MODE === 'dev',
});
const flowLogEnabled = process.env.FLOW_LOG === '1';
const maxUploadBytes = 5 * 1024 * 1024;
const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  try {
    if (!req.url || !req.method) {
      logFlow('API_REQUEST_REJECTED', { requestId, reason: 'INVALID_REQUEST' });
      sendJson(res, 400, { error: 'invalid request' });
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    logFlow('API_REQUEST_START', {
      requestId,
      method: req.method,
      path: url.pathname,
    });

    if (req.method === 'POST' && url.pathname === '/commands') {
      const payload = (await readJson(req)) as { envelope?: unknown; bypassActorId?: string };
      if (!payload.envelope || typeof payload.envelope !== 'object') {
        logFlow('API_POST_COMMAND_REJECTED', {
          requestId,
          reason: 'MISSING_ENVELOPE',
          bypassActorIdProvided: typeof payload.bypassActorId === 'string' && payload.bypassActorId.length > 0,
        });
        sendJson(res, 400, { error: 'request body must include envelope object' });
        return;
      }
      logFlow('API_POST_COMMAND_REQUEST', {
        requestId,
        bypassActorIdProvided: typeof payload.bypassActorId === 'string' && payload.bypassActorId.length > 0,
        ...summarizeCommandEnvelope(payload.envelope),
      });
      const response = await service.postCommands({
        envelope: payload.envelope as any,
        authHeader: req.headers.authorization,
        bypassActorId: payload.bypassActorId,
      });
      logFlow('API_POST_COMMAND_ACCEPTED', { requestId, commandId: response.commandId, status: response.status });
      sendJson(res, 202, response);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/me/profile/sync') {
      const payload = (await readJson(req)) as { bypassActorId?: string };
      const profile = await service.readApis.syncMyProfile({
        authHeader: req.headers.authorization,
        bypassActorId: typeof payload.bypassActorId === 'string' ? payload.bypassActorId : undefined,
      });
      logFlow('API_POST_ME_PROFILE_SYNC', {
        requestId,
        actorId: profile.playerId,
        roles: profile.roles,
        emailNormalized: profile.emailNormalized,
      });
      sendJson(res, 200, profile);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/commands/')) {
      const commandId = decodeURIComponent(url.pathname.slice('/commands/'.length));
      const status = await service.readApis.getCommandStatus(commandId);
      if (!status) {
        logFlow('API_GET_COMMAND_STATUS_MISS', { requestId, commandId });
        sendJson(res, 404, { error: 'command not found' });
        return;
      }
      logFlow('API_GET_COMMAND_STATUS_HIT', {
        requestId,
        commandId,
        status: status.status,
        errorCode: status.errorCode,
      });
      sendJson(res, 200, status);
      return;
    }

    const charMatch = url.pathname.match(/^\/games\/([^/]+)\/characters\/([^/]+)$/);
    if (req.method === 'GET' && charMatch) {
      const gameId = decodeURIComponent(charMatch[1]!);
      const characterId = decodeURIComponent(charMatch[2]!);
      const character = await service.readApis.getCharacter(gameId, characterId);
      if (!character) {
        logFlow('API_GET_CHARACTER_MISS', { requestId, gameId, characterId });
        sendJson(res, 404, { error: 'character not found' });
        return;
      }
      logFlow('API_GET_CHARACTER_HIT', {
        requestId,
        gameId,
        characterId,
        status: (character as { status?: unknown }).status ?? null,
        version: (character as { version?: unknown }).version ?? null,
      });
      sendJson(res, 200, character);
      return;
    }

    const gameMeMatch = url.pathname.match(/^\/games\/([^/]+)\/me$/);
    if (req.method === 'GET' && gameMeMatch) {
      const gameId = decodeURIComponent(gameMeMatch[1]!);
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      const context = await service.readApis.getGameActorContext(gameId, actorId);
      logFlow('API_GET_GAME_ACTOR_CONTEXT', {
        requestId,
        gameId,
        actorId,
        isGameMaster: context.isGameMaster,
        roles: context.roles,
        gmPlayerId: context.gmPlayerId,
      });
      sendJson(res, 200, context);
      return;
    }

    const uploadUrlMatch = url.pathname.match(/^\/games\/([^/]+)\/characters\/([^/]+)\/appearance\/upload-url$/);
    if (req.method === 'POST' && uploadUrlMatch) {
      const gameId = decodeURIComponent(uploadUrlMatch[1]!);
      const characterId = decodeURIComponent(uploadUrlMatch[2]!);
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      await assertCharacterOwnerOrGameMaster(deps.db, {
        gameId,
        characterId,
        actorId,
      });
      const body = (await readJson(req)) as { contentType?: unknown; fileName?: unknown; fileSizeBytes?: unknown };
      const contentType = typeof body.contentType === 'string' ? body.contentType : '';
      const fileName = typeof body.fileName === 'string' ? body.fileName : '';
      const fileSizeBytes = typeof body.fileSizeBytes === 'number' ? body.fileSizeBytes : 0;

      if (!allowedContentTypes.has(contentType)) {
        logFlow('API_APPEARANCE_UPLOAD_URL_REJECTED', {
          requestId,
          gameId,
          characterId,
          reason: 'UNSUPPORTED_CONTENT_TYPE',
          contentType,
        });
        sendJson(res, 400, { error: 'unsupported contentType' });
        return;
      }
      if (!fileName) {
        logFlow('API_APPEARANCE_UPLOAD_URL_REJECTED', {
          requestId,
          gameId,
          characterId,
          reason: 'MISSING_FILE_NAME',
        });
        sendJson(res, 400, { error: 'fileName is required' });
        return;
      }
      if (fileSizeBytes <= 0 || fileSizeBytes > maxUploadBytes) {
        logFlow('API_APPEARANCE_UPLOAD_URL_REJECTED', {
          requestId,
          gameId,
          characterId,
          reason: 'INVALID_FILE_SIZE_BYTES',
          fileSizeBytes,
        });
        sendJson(res, 400, { error: 'fileSizeBytes exceeds max size' });
        return;
      }

      const uploadId = randomUUID();
      const extension = contentTypeToExtension(contentType);
      const s3Key = `games/${gameId}/characters/${characterId}/appearance/${uploadId}.${extension}`;
      const putUrl = await deps.uploads.createSignedUploadUrl({
        key: s3Key,
        contentType,
        expiresInSeconds: 900,
      });
      const getUrl = await deps.uploads.createSignedDownloadUrl({
        key: s3Key,
        expiresInSeconds: 900,
      });

      logFlow('API_APPEARANCE_UPLOAD_URL_ISSUED', {
        requestId,
        actorId,
        uploadId,
        gameId,
        characterId,
        s3Key,
        contentType,
        fileSizeBytes,
      });
      sendJson(res, 200, { uploadId, s3Key, putUrl, getUrl, expiresInSeconds: 900 });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/me/inbox') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      const inbox = await service.readApis.getMyInbox(actorId);
      logFlow('API_GET_PLAYER_INBOX', { requestId, actorId, count: inbox.length });
      sendJson(res, 200, inbox);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/me') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      const existingProfile = await service.readApis.getMyProfile(actorId);
      const profile =
        existingProfile ??
        (await service.readApis.syncMyProfile({
          authHeader: req.headers.authorization,
          bypassActorId: actorId,
        }));
      logFlow('API_GET_ME', { requestId, actorId, found: Boolean(profile) });
      sendJson(res, 200, profile ?? { playerId: actorId });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/me/characters') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      const characters = await service.readApis.listCharactersByOwner(actorId);
      logFlow('API_GET_MY_CHARACTERS', { requestId, actorId, count: characters.length });
      sendJson(res, 200, characters);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/me/games') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      const games = await service.readApis.listGamesForPlayer(actorId);
      logFlow('API_GET_MY_GAMES', { requestId, actorId, count: games.length });
      sendJson(res, 200, games);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/games/public') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      const games = await service.readApis.listPublicGames();
      logFlow('API_GET_PUBLIC_GAMES', { requestId, actorId, count: games.length });
      sendJson(res, 200, games);
      return;
    }

    const gmMatch = url.pathname.match(/^\/gm\/([^/]+)\/inbox$/);
    if (req.method === 'GET' && gmMatch) {
      const gameId = decodeURIComponent(gmMatch[1]!);
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      await assertGameMasterActor(deps.db, { gameId, actorId });
      const inbox = await service.readApis.getGmInbox(gameId);
      logFlow('API_GET_GM_INBOX', { requestId, actorId, gameId, count: inbox.length });
      sendJson(res, 200, inbox);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/gm/games') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      const games = await service.readApis.listGamesForGm(actorId);
      logFlow('API_GET_GM_GAMES', { requestId, actorId, count: games.length });
      sendJson(res, 200, games);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin/users') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      await assertActorHasRole(deps.db, { actorId, role: 'ADMIN' });
      const users = await service.readApis.listUsers();
      logFlow('API_GET_ADMIN_USERS', { requestId, actorId, count: users.length });
      sendJson(res, 200, users);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin/games') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
        devActorIdHeader: readDevActorIdHeader(req.headers['x-dev-actor-id']),
      });
      await assertActorHasRole(deps.db, { actorId, role: 'ADMIN' });
      const games = await service.readApis.listAllGames();
      logFlow('API_GET_ADMIN_GAMES', { requestId, actorId, count: games.length });
      sendJson(res, 200, games);
      return;
    }

    logFlow('API_REQUEST_REJECTED', { requestId, method: req.method, path: url.pathname, reason: 'NOT_FOUND' });
    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    const url = req.url ? new URL(req.url, `http://localhost:${port}`) : null;
    logFlow('API_REQUEST_ERROR', {
      requestId,
      method: req.method ?? null,
      path: url?.pathname ?? null,
      ...summarizeError(error),
    });
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, readStatusCode(error), { error: message });
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});

function sendJson(res: import('node:http').ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function logFlow(event: string, data: Record<string, unknown>): void {
  logServiceFlow({
    enabled: flowLogEnabled,
    service: 'api',
    event,
    data,
  });
}

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const bytes = await readBuffer(req);
  if (bytes.length === 0) {
    return {};
  }
  return JSON.parse(bytes.toString('utf8'));
}

async function readBuffer(req: import('node:http').IncomingMessage): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function contentTypeToExtension(contentType: string): string {
  if (contentType === 'image/png') {
    return 'png';
  }
  if (contentType === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

function readStatusCode(error: unknown): number {
  if (error && typeof error === 'object' && typeof (error as { statusCode?: unknown }).statusCode === 'number') {
    return (error as { statusCode: number }).statusCode;
  }
  return 400;
}

function readDevActorIdHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}
