import { logServiceFlow, type DbAccess } from '@starter/services-shared';
import { createAdminReadApis } from './features/admin/service.js';
import { createCommandReadApis, createCommandRuntimeService } from './features/commands/service.js';
import { createGameReadApis } from './features/games/service.js';
import { createGameplayReadApis } from './features/gameplay/service.js';
import { createGmReadApis } from './features/gm/service.js';
import { createMeReadApis } from './features/me/service.js';
import { createPregameReadApis } from './features/pregame/service.js';
import { listContractRoutes } from './httpRoutes.js';
import type {
  ApiRuntimeService,
} from './apiTypes.js';

export interface ApiServiceDependencies {
  db: DbAccess;
  uploads: {
    headObject(key: string): Promise<boolean>;
    createSignedDownloadUrl(input: { key: string; expiresInSeconds: number }): Promise<string>;
  };
  queue: {
    sendMessage(input: {
      queueUrl: string;
      messageBody: string;
      messageGroupId: string;
      messageDeduplicationId: string;
    }): Promise<void>;
  };
  queueUrl: string;
  jwtBypass?: boolean;
}

export { listContractRoutes };

export function createApiService(deps: ApiServiceDependencies): ApiRuntimeService {
  const flowLogEnabled = process.env.FLOW_LOG === '1';

  return {
    ...createCommandRuntimeService(deps, flowLogEnabled),

    readApis: {
      ...createAdminReadApis(deps),
      ...createCommandReadApis(deps),
      ...createGameReadApis(deps),
      ...createGameplayReadApis(deps),
      ...createGmReadApis(deps),
      ...createMeReadApis(deps, flowLogEnabled, logServiceFlow),
      ...createPregameReadApis(deps),
    },
  };
}
