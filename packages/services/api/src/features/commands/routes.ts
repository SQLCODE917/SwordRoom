import { requireCommandAccess } from '../../routeAuth.js';
import type { ApiRouteDefinition } from '../../httpRouteTypes.js';

export const commandRouteDefinitions: ApiRouteDefinition[] = [
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
        envelopeType:
          typeof (payload.envelope as { type?: unknown }).type === 'string'
            ? (payload.envelope as { type: string }).type
            : null,
      });
      const response = await context.runtime.service.postCommands({
        envelope: payload.envelope as any,
        authHeader: context.req.headers.authorization,
        bypassActorId: context.identity.authMode === 'dev' ? context.identity.actorId : undefined,
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
];
