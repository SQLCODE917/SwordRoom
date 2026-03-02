import { createDispatcher } from './index.js';
import { createDispatcherAwsClients, deleteCommandMessage, receiveCommandMessages } from './awsClients.js';

const clients = createDispatcherAwsClients();
const dispatcher = createDispatcher({ db: clients.db });

let stopping = false;

process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});

async function run(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Dispatcher polling ${clients.queueUrl}`);

  while (!stopping) {
    try {
      const messages = await receiveCommandMessages(clients.sqs, clients.queueUrl, 10);
      if (messages.length === 0) {
        continue;
      }

      for (const message of messages) {
        const envelope = JSON.parse(message.messageBody);
        const result = await dispatcher.dispatch(envelope);

        if (result.outcome === 'PROCESSED' || result.outcome === 'NOOP_ALREADY_PROCESSED') {
          await deleteCommandMessage(clients.sqs, clients.queueUrl, message.receiptHandle);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(`Dispatcher loop error: ${message}`);
      await sleep(1000);
    }
  }
}

void run();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
