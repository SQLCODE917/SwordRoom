import { createServer } from 'node:http';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createApiAwsClients } from './awsClients.js';
import { createApiService } from './index.js';
import { resolveActorId } from './auth.js';

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
const deps = createApiAwsClients();
const service = createApiService({
  db: deps.db,
  queue: deps.queue,
  queueUrl: deps.queueUrl,
  jwtBypass: process.env.AUTH_MODE === 'dev',
});

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      sendJson(res, 400, { error: 'invalid request' });
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method === 'POST' && url.pathname === '/commands') {
      const payload = (await readJson(req)) as { envelope?: unknown; bypassActorId?: string };
      if (!payload.envelope || typeof payload.envelope !== 'object') {
        sendJson(res, 400, { error: 'request body must include envelope object' });
        return;
      }
      const response = await service.postCommands({
        envelope: payload.envelope as any,
        authHeader: req.headers.authorization,
        bypassActorId: payload.bypassActorId,
      });
      sendJson(res, 202, response);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/commands/')) {
      const commandId = decodeURIComponent(url.pathname.slice('/commands/'.length));
      const status = await service.readApis.getCommandStatus(commandId);
      if (!status) {
        sendJson(res, 404, { error: 'command not found' });
        return;
      }
      sendJson(res, 200, status);
      return;
    }

    const charMatch = url.pathname.match(/^\/games\/([^/]+)\/characters\/([^/]+)$/);
    if (req.method === 'GET' && charMatch) {
      const gameId = decodeURIComponent(charMatch[1]!);
      const characterId = decodeURIComponent(charMatch[2]!);
      const character = await service.readApis.getCharacter(gameId, characterId);
      if (!character) {
        sendJson(res, 404, { error: 'character not found' });
        return;
      }
      sendJson(res, 200, character);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/me/inbox') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
      });
      const inbox = await service.readApis.getMyInbox(actorId);
      sendJson(res, 200, inbox);
      return;
    }

    const gmMatch = url.pathname.match(/^\/gm\/([^/]+)\/inbox$/);
    if (req.method === 'GET' && gmMatch) {
      const gameId = decodeURIComponent(gmMatch[1]!);
      const inbox = await service.readApis.getGmInbox(gameId);
      sendJson(res, 200, inbox);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 400, { error: message });
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

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
