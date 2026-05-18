import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DbAccess } from '@starter/services-shared';
import type { ResolvedActorIdentity } from './auth.js';
import type { ApiRoute, ApiRuntimeService } from './apiTypes.js';

export interface ApiRouteRuntime {
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

export interface ApiRouteDispatchInput {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  requestId: string;
  runtime: ApiRouteRuntime;
  trustedIdentity?: ResolvedActorIdentity;
  readJson(req: IncomingMessage): Promise<unknown>;
  sendJson(res: ServerResponse, statusCode: number, body: unknown): void;
  logFlow(event: string, data: Record<string, unknown>): void;
  readDevActorIdHeader(value: string | string[] | undefined): string | undefined;
}

export interface ApiRouteContext {
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

export interface ApiRouteDefinition extends ApiRoute {
  documented?: boolean;
  handler(context: ApiRouteContext): Promise<void>;
}
