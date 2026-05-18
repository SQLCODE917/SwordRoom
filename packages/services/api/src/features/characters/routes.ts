import { randomUUID } from 'node:crypto';
import { assertCharacterOwnerOrGameMaster } from '@starter/services-shared';
import type { ApiRouteDefinition } from '../../httpRouteTypes.js';

export const characterRouteDefinitions: ApiRouteDefinition[] = [
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
];

function contentTypeToExtension(contentType: string): string {
  if (contentType === 'image/png') {
    return 'png';
  }
  if (contentType === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}
