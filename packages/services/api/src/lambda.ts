import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { logServiceFlow, summarizeError } from '@starter/services-shared';
import { isDevAuthEnabled, resolveActorIdentityFromAuthorizerClaims, type ResolvedActorIdentity } from './auth.js';
import { createApiAwsClients } from './awsClients.js';
import { dispatchApiRoute } from './httpRoutes.js';
import { createApiService } from './index.js';

interface HttpApiEventV2 {
  rawPath?: string;
  rawQueryString?: string;
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    requestId?: string;
    http?: { method?: string; path?: string };
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

interface HttpApiResponseV2 {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

interface MutableResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(name: string, value: string | number | readonly string[]): MutableResponse;
  end(chunk?: unknown): MutableResponse;
}

const deps = createApiAwsClients();
const service = createApiService({
  db: deps.db,
  uploads: deps.uploads,
  queue: deps.queue,
  queueUrl: deps.queueUrl,
  jwtBypass: isDevAuthEnabled(),
});
const flowLogEnabled = process.env.FLOW_LOG === '1';
const maxUploadBytes = 5 * 1024 * 1024;
const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function handler(event: HttpApiEventV2): Promise<HttpApiResponseV2> {
  const requestId = event.requestContext?.requestId ?? randomUUID();
  const method = event.requestContext?.http?.method ?? 'GET';
  const pathname = event.rawPath ?? event.requestContext?.http?.path ?? '/';
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = new URL(`${pathname}${query}`, 'https://lambda.local');
  const headers = normalizeHeaders(event.headers);
  const req = createRequest({
    method,
    url: `${pathname}${query}`,
    headers,
    body: decodeBody(event.body, event.isBase64Encoded),
  });
  const res = createResponse();

  try {
    const handled = await dispatchApiRoute({
      req,
      res: res as unknown as ServerResponse,
      url,
      requestId,
      runtime: {
        db: deps.db,
        uploads: deps.uploads,
        service,
        authBypassAllowed: isDevAuthEnabled(),
        maxUploadBytes,
        allowedContentTypes,
      },
      trustedIdentity: resolveTrustedIdentity(event),
      readJson,
      sendJson,
      logFlow,
      readDevActorIdHeader,
    });

    if (!handled) {
      logFlow('API_REQUEST_REJECTED', { requestId, method, path: pathname, reason: 'NOT_FOUND' });
      sendJson(res as unknown as ServerResponse, 404, { error: 'not found' });
    }
  } catch (error) {
    logFlow('API_REQUEST_ERROR', {
      requestId,
      method,
      path: pathname,
      ...summarizeError(error),
    });
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res as unknown as ServerResponse, readStatusCode(error), { error: message });
  }

  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body || '',
    isBase64Encoded: false,
  };
}

function resolveTrustedIdentity(event: HttpApiEventV2): ResolvedActorIdentity | undefined {
  return resolveActorIdentityFromAuthorizerClaims(event.requestContext?.authorizer?.jwt?.claims) ?? undefined;
}

function normalizeHeaders(headers: Record<string, string | undefined> | undefined): IncomingHttpHeaders {
  const normalized: IncomingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    normalized[name.toLowerCase()] = value;
  }
  return normalized;
}

function createRequest(input: {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
}): IncomingMessage {
  const stream = Readable.from(input.body.length > 0 ? [input.body] : []) as IncomingMessage;
  stream.method = input.method;
  stream.url = input.url;
  stream.headers = input.headers;
  return stream;
}

function createResponse(): MutableResponse {
  const response: MutableResponse = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      response.headers[name.toLowerCase()] = Array.isArray(value) ? value.join(',') : String(value);
      return response;
    },
    end(chunk) {
      response.body =
        typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk == null ? '' : String(chunk);
      return response;
    },
  };
  return response;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
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

async function readJson(req: IncomingMessage): Promise<unknown> {
  const bytes = await readBuffer(req);
  if (bytes.length === 0) {
    return {};
  }
  return JSON.parse(bytes.toString('utf8'));
}

async function readBuffer(req: IncomingMessage): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function decodeBody(body: string | null | undefined, isBase64Encoded: boolean | undefined): Buffer {
  if (!body) {
    return Buffer.alloc(0);
  }
  return Buffer.from(body, isBase64Encoded ? 'base64' : 'utf8');
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
