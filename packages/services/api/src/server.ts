import { createServer } from 'node:http';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { logServiceFlow, summarizeError } from '@starter/services-shared';
import { createApiAwsClients } from './awsClients.js';
import { createApiService } from './index.js';
import { dispatchApiRoute } from './httpRoutes.js';

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

    const handled = await dispatchApiRoute({
      req,
      res,
      url,
      requestId,
      runtime: {
        db: deps.db,
        uploads: deps.uploads,
        service,
        authBypassAllowed: process.env.AUTH_MODE === 'dev',
        maxUploadBytes,
        allowedContentTypes,
      },
      readJson,
      sendJson,
      logFlow,
      readDevActorIdHeader,
    });
    if (handled) {
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
