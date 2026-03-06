import { createDispatcher } from './index.js';
import { createDispatcherAwsClients, deleteCommandMessage, receiveCommandMessages } from './awsClients.js';

const clients = createDispatcherAwsClients();
const dispatcher = createDispatcher({ db: clients.db });
const flowLogEnabled = process.env.FLOW_LOG === '1';

let stopping = false;

process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});

async function run(): Promise<void> {
  logFlow('DISPATCHER_POLL_START', { queueUrl: clients.queueUrl });

  while (!stopping) {
    try {
      const messages = await receiveCommandMessages(clients.sqs, clients.queueUrl, 10);
      if (messages.length === 0) {
        continue;
      }
      logFlow('DISPATCHER_RECEIVE_BATCH', { count: messages.length });

      for (const message of messages) {
        const envelope = JSON.parse(message.messageBody);
        logFlow('DISPATCHER_MESSAGE_RECEIVED', envelopeSummary(envelope));
        const result = await dispatcher.dispatch(envelope);
        logFlow('DISPATCHER_MESSAGE_RESULT', {
          ...envelopeSummary(envelope),
          outcome: result.outcome,
          errorCode: result.errorCode ?? null,
        });

        if (result.outcome === 'PROCESSED' || result.outcome === 'NOOP_ALREADY_PROCESSED') {
          await deleteCommandMessage(clients.sqs, clients.queueUrl, message.receiptHandle);
          logFlow('DISPATCHER_MESSAGE_DELETED', envelopeSummary(envelope));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logFlow('DISPATCHER_LOOP_ERROR', { message });
      await sleep(1000);
    }
  }
}

void run();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logFlow(event: string, data: Record<string, unknown>): void {
  if (!flowLogEnabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), svc: 'dispatcher', event, ...data }));
}

function envelopeSummary(envelope: unknown): Record<string, unknown> {
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
