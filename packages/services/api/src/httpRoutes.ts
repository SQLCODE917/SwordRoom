import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { assertCharacterOwnerOrGameMaster, assertGameMasterActor, type DbAccess } from '@starter/services-shared';
import type { ResolvedActorIdentity } from './auth.js';
import type { ApiRoute, ApiRuntimeService } from './apiTypes.js';
import { requireActor, requireCommandAccess, requireGameAccess, requireRole } from './routeAuth.js';

interface ApiRouteRuntime {
  db: DbAccess;
  uploads: {
    createSignedUploadUrl(input: { key: string; contentType: string; expiresInSeconds: number }): Promise<string>;
    createSignedDownloadUrl(input: { key: string; expiresInSeconds: number }): Promise<string>;
  };
  service: ApiRuntimeService;
  authBypassAllowed: boolean;
  maxUploadBytes: number;
  allowedContentTypes: ReadonlySet<string>;
}

interface ApiRouteDispatchInput {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  requestId: string;
  runtime: ApiRouteRuntime;
  readJson(req: IncomingMessage): Promise<unknown>;
  sendJson(res: ServerResponse, statusCode: number, body: unknown): void;
  logFlow(event: string, data: Record<string, unknown>): void;
  readDevActorIdHeader(value: string | string[] | undefined): string | undefined;
}

interface ApiRouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  requestId: string;
  params: Record<string, string>;
  identity: ResolvedActorIdentity;
  runtime: ApiRouteRuntime;
  readJsonBody(): Promise<unknown>;
  sendJson(statusCode: number, body: unknown): void;
  logFlow(event: string, data: Record<string, unknown>): void;
}

interface ApiRouteDefinition extends ApiRoute {
  documented?: boolean;
  handler(context: ApiRouteContext): Promise<void>;
}

const routeDefinitions: ApiRouteDefinition[] = [
  {
    method: 'POST',
    path: '/commands',
    auth: 'required',
    handler: async (context) => {
      const payload = (await context.readJsonBody()) as { envelope?: unknown; bypassActorId?: string };
      if (!payload.envelope || typeof payload.envelope !== 'object') {
        context.logFlow('API_POST_COMMAND_REJECTED', {
          requestId: context.requestId,
          reason: 'MISSING_ENVELOPE',
          bypassActorIdProvided: typeof payload.bypassActorId === 'string' && payload.bypassActorId.length > 0,
        });
        context.sendJson(400, { error: 'request body must include envelope object' });
        return;
      }
      context.logFlow('API_POST_COMMAND_REQUEST', {
        requestId: context.requestId,
        bypassActorIdProvided: typeof payload.bypassActorId === 'string' && payload.bypassActorId.length > 0,
        envelopeType: typeof (payload.envelope as { type?: unknown }).type === 'string' ? (payload.envelope as { type: string }).type : null,
      });
      const response = await context.runtime.service.postCommands({
        envelope: payload.envelope as any,
        authHeader: context.req.headers.authorization,
        bypassActorId: context.identity.actorId,
      });
      context.logFlow('API_POST_COMMAND_ACCEPTED', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        commandId: response.commandId,
        status: response.status,
      });
      context.sendJson(202, response);
    },
  },
  {
    method: 'POST',
    path: '/me/profile/sync',
    auth: 'required',
    handler: async (context) => {
      const profile = await context.runtime.service.readApis.syncMyProfile({
        authHeader: context.req.headers.authorization,
        bypassActorId: context.identity.actorId,
      });
      context.logFlow('API_POST_ME_PROFILE_SYNC', {
        requestId: context.requestId,
        actorId: profile.playerId,
        roles: profile.roles,
        emailNormalized: profile.emailNormalized,
      });
      context.sendJson(200, profile);
    },
  },
  {
    method: 'GET',
    path: '/commands/{commandId}',
    auth: 'required',
    handler: async (context) => {
      const commandId = context.params.commandId!;
      await requireCommandAccess({
        db: context.runtime.db,
        identity: context.identity,
        commandId,
      });
      const status = await context.runtime.service.readApis.getCommandStatus(commandId);
      if (!status) {
        context.logFlow('API_GET_COMMAND_STATUS_MISS', {
          requestId: context.requestId,
          actorId: context.identity.actorId,
          commandId,
        });
        context.sendJson(404, { error: 'command not found' });
        return;
      }
      context.logFlow('API_GET_COMMAND_STATUS_HIT', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        commandId,
        status: status.status,
        errorCode: status.errorCode,
      });
      context.sendJson(200, status);
    },
  },
  {
    method: 'GET',
    path: '/me',
    auth: 'required',
    handler: async (context) => {
      const existingProfile = await context.runtime.service.readApis.getMyProfile(context.identity.actorId);
      const profile =
        existingProfile ??
        (await context.runtime.service.readApis.syncMyProfile({
          authHeader: context.req.headers.authorization,
          bypassActorId: context.identity.actorId,
        }));
      context.logFlow('API_GET_ME', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        found: Boolean(profile),
      });
      context.sendJson(200, profile ?? { playerId: context.identity.actorId });
    },
  },
  {
    method: 'GET',
    path: '/me/characters',
    auth: 'required',
    handler: async (context) => {
      const characters = await context.runtime.service.readApis.listCharactersByOwner(context.identity.actorId);
      context.logFlow('API_GET_MY_CHARACTERS', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: characters.length,
      });
      context.sendJson(200, characters);
    },
  },
  {
    method: 'GET',
    path: '/me/games',
    auth: 'required',
    handler: async (context) => {
      const games = await context.runtime.service.readApis.listGamesForPlayer(context.identity.actorId);
      context.logFlow('API_GET_MY_GAMES', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: games.length,
      });
      context.sendJson(200, games);
    },
  },
  {
    method: 'GET',
    path: '/games/public',
    auth: 'required',
    handler: async (context) => {
      const games = await context.runtime.service.readApis.listPublicGames();
      context.logFlow('API_GET_PUBLIC_GAMES', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: games.length,
      });
      context.sendJson(200, games);
    },
  },
  {
    method: 'GET',
    path: '/games/{gameId}/me',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      const actorContext = await context.runtime.service.readApis.getGameActorContext(gameId, context.identity.actorId);
      context.logFlow('API_GET_GAME_ACTOR_CONTEXT', {
        requestId: context.requestId,
        gameId,
        actorId: context.identity.actorId,
        isGameMaster: actorContext.isGameMaster,
        roles: actorContext.roles,
        gmPlayerId: actorContext.gmPlayerId,
      });
      context.sendJson(200, actorContext);
    },
  },
  {
    method: 'GET',
    path: '/games/{gameId}/characters/{characterId}',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      const characterId = context.params.characterId!;
      await requireGameAccess({
        db: context.runtime.db,
        identity: context.identity,
        gameId,
        characterId,
      });
      const character = await context.runtime.service.readApis.getCharacter(gameId, characterId);
      if (!character) {
        context.logFlow('API_GET_CHARACTER_MISS', {
          requestId: context.requestId,
          actorId: context.identity.actorId,
          gameId,
          characterId,
        });
        context.sendJson(404, { error: 'character not found' });
        return;
      }
      context.logFlow('API_GET_CHARACTER_HIT', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        characterId,
        status: (character as { status?: unknown }).status ?? null,
        version: (character as { version?: unknown }).version ?? null,
      });
      context.sendJson(200, character);
    },
  },
  {
    method: 'POST',
    path: '/games/{gameId}/characters/{characterId}/appearance/upload-url',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      const characterId = context.params.characterId!;
      await assertCharacterOwnerOrGameMaster(context.runtime.db, {
        gameId,
        characterId,
        actorId: context.identity.actorId,
      });

      const body = (await context.readJsonBody()) as {
        contentType?: unknown;
        fileName?: unknown;
        fileSizeBytes?: unknown;
      };
      const contentType = typeof body.contentType === 'string' ? body.contentType : '';
      const fileName = typeof body.fileName === 'string' ? body.fileName : '';
      const fileSizeBytes = typeof body.fileSizeBytes === 'number' ? body.fileSizeBytes : 0;

      if (!context.runtime.allowedContentTypes.has(contentType)) {
        context.logFlow('API_APPEARANCE_UPLOAD_URL_REJECTED', {
          requestId: context.requestId,
          gameId,
          characterId,
          reason: 'UNSUPPORTED_CONTENT_TYPE',
          contentType,
        });
        context.sendJson(400, { error: 'unsupported contentType' });
        return;
      }

      if (!fileName) {
        context.logFlow('API_APPEARANCE_UPLOAD_URL_REJECTED', {
          requestId: context.requestId,
          gameId,
          characterId,
          reason: 'MISSING_FILE_NAME',
        });
        context.sendJson(400, { error: 'fileName is required' });
        return;
      }

      if (fileSizeBytes <= 0 || fileSizeBytes > context.runtime.maxUploadBytes) {
        context.logFlow('API_APPEARANCE_UPLOAD_URL_REJECTED', {
          requestId: context.requestId,
          gameId,
          characterId,
          reason: 'INVALID_FILE_SIZE_BYTES',
          fileSizeBytes,
        });
        context.sendJson(400, { error: 'fileSizeBytes exceeds max size' });
        return;
      }

      const uploadId = randomUUID();
      const extension = contentTypeToExtension(contentType);
      const s3Key = `games/${gameId}/characters/${characterId}/appearance/${uploadId}.${extension}`;
      const putUrl = await context.runtime.uploads.createSignedUploadUrl({
        key: s3Key,
        contentType,
        expiresInSeconds: 900,
      });
      const getUrl = await context.runtime.uploads.createSignedDownloadUrl({
        key: s3Key,
        expiresInSeconds: 900,
      });

      context.logFlow('API_APPEARANCE_UPLOAD_URL_ISSUED', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        uploadId,
        gameId,
        characterId,
        s3Key,
        contentType,
        fileSizeBytes,
      });
      context.sendJson(200, { uploadId, s3Key, putUrl, getUrl, expiresInSeconds: 900 });
    },
  },
  {
    method: 'GET',
    path: '/games/{gameId}',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      const { game } = await requireGameAccess({
        db: context.runtime.db,
        identity: context.identity,
        gameId,
      });
      context.logFlow('API_GET_GAME_HIT', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        visibility: game.visibility,
        gmPlayerId: game.gmPlayerId,
      });
      context.sendJson(200, game);
    },
  },
  {
    method: 'GET',
    path: '/players/{playerId}/characters/{characterId}',
    auth: 'required',
    handler: async (context) => {
      const playerId = context.params.playerId!;
      const characterId = context.params.characterId!;
      if (context.identity.actorId !== playerId) {
        context.logFlow('API_GET_OWNED_CHARACTER_FORBIDDEN', {
          requestId: context.requestId,
          actorId: context.identity.actorId,
          playerId,
          characterId,
        });
        context.sendJson(403, { error: `player "${playerId}" does not match signed-in actor` });
        return;
      }
      const character = await context.runtime.service.readApis.getOwnedCharacter(playerId, characterId);
      if (!character) {
        context.logFlow('API_GET_OWNED_CHARACTER_MISS', {
          requestId: context.requestId,
          playerId,
          characterId,
        });
        context.sendJson(404, { error: 'character not found' });
        return;
      }
      context.logFlow('API_GET_OWNED_CHARACTER_HIT', {
        requestId: context.requestId,
        playerId,
        characterId,
        status: (character as { status?: unknown }).status ?? null,
        version: (character as { version?: unknown }).version ?? null,
      });
      context.sendJson(200, character);
    },
  },
  {
    method: 'GET',
    path: '/me/inbox',
    auth: 'required',
    handler: async (context) => {
      const inbox = await context.runtime.service.readApis.getMyInbox(context.identity.actorId);
      context.logFlow('API_GET_PLAYER_INBOX', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: inbox.length,
      });
      context.sendJson(200, inbox);
    },
  },
  {
    method: 'GET',
    path: '/gm/games',
    auth: 'required',
    handler: async (context) => {
      const games = await context.runtime.service.readApis.listGamesForGm(context.identity.actorId);
      context.logFlow('API_GET_GM_GAMES', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: games.length,
      });
      context.sendJson(200, games);
    },
  },
  {
    method: 'GET',
    path: '/gm/{gameId}/inbox',
    auth: 'gm_required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      if (!context.identity.roles.includes('ADMIN')) {
        await assertGameMasterActor(context.runtime.db, { gameId, actorId: context.identity.actorId });
      }
      const inbox = await context.runtime.service.readApis.getGmInbox(gameId);
      context.logFlow('API_GET_GM_INBOX', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        count: inbox.length,
      });
      context.sendJson(200, inbox);
    },
  },
  {
    method: 'GET',
    path: '/admin/users',
    auth: 'admin_required',
    handler: async (context) => {
      const users = await context.runtime.service.readApis.listUsers();
      context.logFlow('API_GET_ADMIN_USERS', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: users.length,
      });
      context.sendJson(200, users);
    },
  },
  {
    method: 'GET',
    path: '/admin/games',
    auth: 'admin_required',
    handler: async (context) => {
      const games = await context.runtime.service.readApis.listAllGames();
      context.logFlow('API_GET_ADMIN_GAMES', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: games.length,
      });
      context.sendJson(200, games);
    },
  },
];

export function listContractRoutes(): ApiRoute[] {
  return routeDefinitions.map(({ method, path, auth }) => ({ method, path, auth }));
}

export async function dispatchApiRoute(input: ApiRouteDispatchInput): Promise<boolean> {
  const matched = matchApiRoute(input.req.method, input.url.pathname);
  if (!matched) {
    return false;
  }

  let parsedBody: unknown;
  let bodyLoaded = false;
  const readJsonBody = async (): Promise<unknown> => {
    if (!bodyLoaded) {
      parsedBody = await input.readJson(input.req);
      bodyLoaded = true;
    }
    return parsedBody;
  };

  const identity = await authorizeRoute({
    route: matched.route,
    req: input.req,
    authBypassAllowed: input.runtime.authBypassAllowed,
    readDevActorIdHeader: input.readDevActorIdHeader,
    readJsonBody,
  });

  await matched.route.handler({
    req: input.req,
    res: input.res,
    url: input.url,
    requestId: input.requestId,
    params: matched.params,
    identity,
    runtime: input.runtime,
    readJsonBody,
    sendJson: (statusCode, body) => input.sendJson(input.res, statusCode, body),
    logFlow: input.logFlow,
  });

  return true;
}

function matchApiRoute(method: string | undefined, pathname: string): { route: ApiRouteDefinition; params: Record<string, string> } | null {
  for (const route of routeDefinitions) {
    if (route.method !== method) {
      continue;
    }
    const params = matchPath(route.path, pathname);
    if (params) {
      return { route, params };
    }
  }
  return null;
}

async function authorizeRoute(input: {
  route: ApiRouteDefinition;
  req: IncomingMessage;
  authBypassAllowed: boolean;
  readDevActorIdHeader(value: string | string[] | undefined): string | undefined;
  readJsonBody(): Promise<unknown>;
}): Promise<ResolvedActorIdentity> {
  const body = input.route.method === 'POST' ? ((await input.readJsonBody()) as { bypassActorId?: unknown }) : null;
  const identity = await requireActor({
    bypassAllowed: input.authBypassAllowed,
    authorizationHeader: input.req.headers.authorization,
    devActorIdHeader: input.readDevActorIdHeader(input.req.headers['x-dev-actor-id']),
    bypassActorId: typeof body?.bypassActorId === 'string' ? body.bypassActorId : undefined,
  });
  if (input.route.auth === 'admin_required') {
    requireRole({ identity, role: 'ADMIN' });
  }
  return identity;
}

function matchPath(template: string, pathname: string): Record<string, string> | null {
  const templateParts = template.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (templateParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < templateParts.length; index += 1) {
    const templatePart = templateParts[index]!;
    const pathPart = pathParts[index]!;
    if (templatePart.startsWith('{') && templatePart.endsWith('}')) {
      params[templatePart.slice(1, -1)] = decodeURIComponent(pathPart);
      continue;
    }
    if (templatePart !== pathPart) {
      return null;
    }
  }

  return params;
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
