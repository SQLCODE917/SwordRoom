import { logServiceFlow, summarizeCommandEnvelope, summarizeError } from '@starter/services-shared';
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
        logFlow('DISPATCHER_MESSAGE_RECEIVED', {
          receiptHandle: message.receiptHandle,
          ...summarizeCommandEnvelope(envelope),
        });
        const result = await dispatcher.dispatch(envelope);
        logFlow('DISPATCHER_MESSAGE_RESULT', {
          receiptHandle: message.receiptHandle,
          ...summarizeCommandEnvelope(envelope),
          outcome: result.outcome,
          errorCode: result.errorCode ?? null,
        });

        if (
          result.outcome === 'PROCESSED' ||
          result.outcome === 'NOOP_ALREADY_PROCESSED' ||
          result.outcome === 'FAILED'
        ) {
          await deleteCommandMessage(clients.sqs, clients.queueUrl, message.receiptHandle);
          logFlow(result.outcome === 'FAILED' ? 'DISPATCHER_MESSAGE_DELETED_AFTER_FAILURE' : 'DISPATCHER_MESSAGE_DELETED', {
            receiptHandle: message.receiptHandle,
            ...summarizeCommandEnvelope(envelope),
            errorCode: result.errorCode ?? null,
          });
          continue;
        }

        logFlow('DISPATCHER_MESSAGE_RETAINED_FOR_RETRY', {
          receiptHandle: message.receiptHandle,
          ...summarizeCommandEnvelope(envelope),
          errorCode: result.errorCode ?? null,
        });
      }
    } catch (error) {
      logFlow('DISPATCHER_LOOP_ERROR', summarizeError(error));
      await sleep(1000);
    }
  }
}

void run();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logFlow(event: string, data: Record<string, unknown>): void {
  logServiceFlow({
    enabled: flowLogEnabled,
    service: 'dispatcher',
    event,
    data,
  });
}
