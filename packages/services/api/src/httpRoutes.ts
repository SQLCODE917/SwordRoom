import type { IncomingMessage } from 'node:http';
import { createCommandTraceContext } from '@starter/shared';
import { buildPregameMetricsFromObservation, readPregameObservationContext } from '@starter/services-shared';
import type { DbAccess } from '@starter/services-shared';
import type { ResolvedActorIdentity } from './auth.js';
import type { ApiRoute } from './apiTypes.js';
import type { ApiRouteDefinition, ApiRouteDispatchInput } from './httpRouteTypes.js';
import { adminRouteDefinitions } from './features/admin/routes.js';
import { characterRouteDefinitions } from './features/characters/routes.js';
import { commandRouteDefinitions } from './features/commands/routes.js';
import { gameRouteDefinitions } from './features/games/routes.js';
import { gmRouteDefinitions } from './features/gm/routes.js';
import { gameplayRouteDefinitions } from './features/gameplay/routes.js';
import { meRouteDefinitions } from './features/me/routes.js';
import { pregameRouteDefinitions } from './features/pregame/routes.js';
import { requireActor, requireCommandAccess, requireGameAccess, requireRole } from './routeAuth.js';

const routeDefinitions: ApiRouteDefinition[] = [
  ...adminRouteDefinitions,
  ...characterRouteDefinitions,
  ...commandRouteDefinitions,
  ...gameRouteDefinitions,
  ...gmRouteDefinitions,
  ...gameplayRouteDefinitions,
  ...meRouteDefinitions,
  ...pregameRouteDefinitions,
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

  input.res.setHeader?.('x-request-id', input.requestId);
  const requestTraceContext = createCommandTraceContext({
    requestId: input.requestId,
    headers: input.req.headers as Record<string, string | string[] | undefined>,
  });
  if (requestTraceContext.xrayTraceHeader) {
    input.res.setHeader?.('x-amzn-trace-id', requestTraceContext.xrayTraceHeader);
  }

  const observation = readPregameObservationContext(input.req.headers as Record<string, string | string[] | undefined>);
  if (observation) {
    for (const metric of buildPregameMetricsFromObservation({
      observation,
      actorId: identity.actorId,
      requestId: input.requestId,
      path: input.url.pathname,
    })) {
      input.logFlow('PREGAME_METRIC', metric as unknown as Record<string, unknown>);
    }
  }

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
    traceContext: requestTraceContext,
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
