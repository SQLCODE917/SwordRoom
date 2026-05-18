import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { assertCharacterOwnerOrGameMaster, assertGameMasterActor, type DbAccess } from '@starter/services-shared';
import type { ResolvedActorIdentity } from './auth.js';
import type { ApiRoute } from './apiTypes.js';
import type { ApiRouteDefinition, ApiRouteDispatchInput } from './httpRouteTypes.js';
import { commandRouteDefinitions } from './features/commands/routes.js';
import { gameRouteDefinitions } from './features/games/routes.js';
import { gameplayRouteDefinitions } from './features/gameplay/routes.js';
import { meRouteDefinitions } from './features/me/routes.js';
import { requireActor, requireCommandAccess, requireGameAccess, requireRole } from './routeAuth.js';

const routeDefinitions: ApiRouteDefinition[] = [
  ...commandRouteDefinitions,
  ...gameRouteDefinitions,
  ...gameplayRouteDefinitions,
  ...meRouteDefinitions,
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
      await assertGameMasterActor(context.runtime.db, { gameId, actorId: context.identity.actorId });
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
  if (input.req.method === 'OPTIONS') {
    input.logFlow('API_OPTIONS_PREFLIGHT', {
      requestId: input.requestId,
      path: input.url.pathname,
    });
    input.res.statusCode = 204;
    input.res.end();
    return true;
  }

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
    db: input.runtime.db,
    trustedIdentity: input.trustedIdentity,
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
  db: DbAccess;
  trustedIdentity?: ResolvedActorIdentity;
  readDevActorIdHeader(value: string | string[] | undefined): string | undefined;
  readJsonBody(): Promise<unknown>;
}): Promise<ResolvedActorIdentity> {
  const body = input.route.method === 'POST' ? ((await input.readJsonBody()) as { bypassActorId?: unknown }) : null;
  const identity =
    input.trustedIdentity ??
    (await requireActor({
      bypassAllowed: input.authBypassAllowed,
      authorizationHeader: input.req.headers.authorization,
      devActorIdHeader: input.readDevActorIdHeader(input.req.headers['x-dev-actor-id']),
      bypassActorId: typeof body?.bypassActorId === 'string' ? body.bypassActorId : undefined,
    }));
  if (input.route.auth === 'admin_required') {
    await requireRole({ db: input.db, identity, role: 'ADMIN' });
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
