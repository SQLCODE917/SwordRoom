import { createServer } from 'node:http';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
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
const flowLogEnabled = process.env.FLOW_LOG === '1';
const maxUploadBytes = 5 * 1024 * 1024;
const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const uploadSessions = new Map<string, UploadSession>();

interface UploadSession {
  uploadId: string;
  token: string;
  gameId: string;
  characterId: string;
  s3Key: string;
  contentType: string;
  expiresAt: number;
  bytes: Buffer | null;
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      sendJson(res, 400, { error: 'invalid request' });
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);

    const uploadPutMatch = url.pathname.match(/^\/uploads\/([^/]+)$/);
    if (req.method === 'PUT' && uploadPutMatch) {
      const uploadId = decodeURIComponent(uploadPutMatch[1]!);
      const token = url.searchParams.get('token') ?? '';
      const session = uploadSessions.get(uploadId);
      if (!session || session.token !== token) {
        sendJson(res, 404, { error: 'upload session not found' });
        return;
      }
      if (Date.now() > session.expiresAt) {
        sendJson(res, 400, { error: 'upload session expired' });
        return;
      }

      const bytes = await readBuffer(req);
      if (bytes.byteLength === 0 || bytes.byteLength > maxUploadBytes) {
        sendJson(res, 400, { error: 'invalid upload byte length' });
        return;
      }

      session.bytes = bytes;
      uploadSessions.set(uploadId, session);
      logFlow('API_APPEARANCE_UPLOAD_BINARY_OK', {
        uploadId,
        gameId: session.gameId,
        characterId: session.characterId,
        bytes: bytes.byteLength,
      });
      res.statusCode = 200;
      res.end();
      return;
    }

    if (req.method === 'POST' && url.pathname === '/commands') {
      const payload = (await readJson(req)) as { envelope?: unknown; bypassActorId?: string };
      if (!payload.envelope || typeof payload.envelope !== 'object') {
        sendJson(res, 400, { error: 'request body must include envelope object' });
        return;
      }
      logFlow('API_POST_COMMAND_REQUEST', readEnvelopeSummary(payload.envelope));
      const response = await service.postCommands({
        envelope: payload.envelope as any,
        authHeader: req.headers.authorization,
        bypassActorId: payload.bypassActorId,
      });
      logFlow('API_POST_COMMAND_ACCEPTED', { commandId: response.commandId, status: response.status });
      sendJson(res, 202, response);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/commands/')) {
      const commandId = decodeURIComponent(url.pathname.slice('/commands/'.length));
      const status = await service.readApis.getCommandStatus(commandId);
      if (!status) {
        logFlow('API_GET_COMMAND_STATUS_MISS', { commandId });
        sendJson(res, 404, { error: 'command not found' });
        return;
      }
      logFlow('API_GET_COMMAND_STATUS_HIT', {
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
        logFlow('API_GET_CHARACTER_MISS', { gameId, characterId });
        sendJson(res, 404, { error: 'character not found' });
        return;
      }
      logFlow('API_GET_CHARACTER_HIT', {
        gameId,
        characterId,
        status: (character as { status?: unknown }).status ?? null,
        version: (character as { version?: unknown }).version ?? null,
      });
      sendJson(res, 200, character);
      return;
    }

    const uploadUrlMatch = url.pathname.match(/^\/games\/([^/]+)\/characters\/([^/]+)\/appearance\/upload-url$/);
    if (req.method === 'POST' && uploadUrlMatch) {
      const gameId = decodeURIComponent(uploadUrlMatch[1]!);
      const characterId = decodeURIComponent(uploadUrlMatch[2]!);
      const body = (await readJson(req)) as { contentType?: unknown; fileName?: unknown; fileSizeBytes?: unknown };
      const contentType = typeof body.contentType === 'string' ? body.contentType : '';
      const fileName = typeof body.fileName === 'string' ? body.fileName : '';
      const fileSizeBytes = typeof body.fileSizeBytes === 'number' ? body.fileSizeBytes : 0;

      if (!allowedContentTypes.has(contentType)) {
        sendJson(res, 400, { error: 'unsupported contentType' });
        return;
      }
      if (!fileName) {
        sendJson(res, 400, { error: 'fileName is required' });
        return;
      }
      if (fileSizeBytes <= 0 || fileSizeBytes > maxUploadBytes) {
        sendJson(res, 400, { error: 'fileSizeBytes exceeds max size' });
        return;
      }

      const uploadId = randomUUID();
      const token = randomUUID();
      const extension = contentTypeToExtension(contentType);
      const s3Key = `games/${gameId}/characters/${characterId}/appearance/${uploadId}.${extension}`;
      const putUrl = `/api/uploads/${encodeURIComponent(uploadId)}?token=${encodeURIComponent(token)}`;
      const getUrl = '';
      uploadSessions.set(uploadId, {
        uploadId,
        token,
        gameId,
        characterId,
        s3Key,
        contentType,
        expiresAt: Date.now() + 15 * 60 * 1000,
        bytes: null,
      });

      logFlow('API_APPEARANCE_UPLOAD_URL_ISSUED', {
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

    const confirmMatch = url.pathname.match(/^\/games\/([^/]+)\/characters\/([^/]+)\/appearance\/confirm$/);
    if (req.method === 'POST' && confirmMatch) {
      const gameId = decodeURIComponent(confirmMatch[1]!);
      const characterId = decodeURIComponent(confirmMatch[2]!);
      const body = (await readJson(req)) as { uploadId?: unknown; s3Key?: unknown };
      const uploadId = typeof body.uploadId === 'string' ? body.uploadId : '';
      const s3Key = typeof body.s3Key === 'string' ? body.s3Key : '';
      if (!uploadId || !s3Key) {
        sendJson(res, 400, { error: 'uploadId and s3Key are required' });
        return;
      }

      const session = uploadSessions.get(uploadId);
      if (!session || session.gameId !== gameId || session.characterId !== characterId || session.s3Key !== s3Key) {
        sendJson(res, 400, { error: 'upload session mismatch' });
        return;
      }
      if (!session.bytes || Date.now() > session.expiresAt) {
        sendJson(res, 400, { error: 'upload session missing binary or expired' });
        return;
      }

      const character = await deps.db.characterRepository.getCharacter(gameId, characterId);
      if (!character) {
        sendJson(res, 404, { error: 'character not found' });
        return;
      }

      const imageUrl = `data:${session.contentType};base64,${session.bytes.toString('base64')}`;
      const now = new Date().toISOString();
      const nextDraft = {
        ...character.draft,
        appearance: {
          imageKey: s3Key,
          imageUrl,
          updatedAt: now,
        },
      } as Record<string, unknown>;
      await deps.db.characterRepository.updateCharacterWithVersion({
        gameId,
        characterId,
        expectedVersion: character.version,
        next: {
          ownerPlayerId: character.ownerPlayerId,
          draft: nextDraft as any,
          updatedAt: now,
          status: character.status,
        },
      });
      uploadSessions.delete(uploadId);

      logFlow('API_APPEARANCE_CONFIRM_OK', { uploadId, gameId, characterId, s3Key });
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/me/inbox') {
      const actorId = await resolveActorId({
        bypassAllowed: process.env.AUTH_MODE === 'dev',
        authorizationHeader: req.headers.authorization,
      });
      const inbox = await service.readApis.getMyInbox(actorId);
      logFlow('API_GET_PLAYER_INBOX', { actorId, count: inbox.length });
      sendJson(res, 200, inbox);
      return;
    }

    const gmMatch = url.pathname.match(/^\/gm\/([^/]+)\/inbox$/);
    if (req.method === 'GET' && gmMatch) {
      const gameId = decodeURIComponent(gmMatch[1]!);
      const inbox = await service.readApis.getGmInbox(gameId);
      logFlow('API_GET_GM_INBOX', { gameId, count: inbox.length });
      sendJson(res, 200, inbox);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logFlow('API_REQUEST_ERROR', { message });
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

function logFlow(event: string, data: Record<string, unknown>): void {
  if (!flowLogEnabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), svc: 'api', event, ...data }));
}

function readEnvelopeSummary(envelope: unknown): Record<string, unknown> {
  if (!envelope || typeof envelope !== 'object') {
    return {};
  }
  const record = envelope as Record<string, unknown>;
  const payload = record.payload && typeof record.payload === 'object' ? (record.payload as Record<string, unknown>) : {};
  return {
    commandId: typeof record.commandId === 'string' ? record.commandId : null,
    type: typeof record.type === 'string' ? record.type : null,
    gameId: typeof record.gameId === 'string' ? record.gameId : null,
    characterId: typeof payload.characterId === 'string' ? payload.characterId : null,
  };
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
