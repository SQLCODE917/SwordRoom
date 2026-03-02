import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { createDbAccess, createDynamoDbDocumentClient, type CommandQueue } from '@starter/services-shared';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`missing env var ${name}`);
  }
  return value;
}

function awsClientConfig() {
  return {
    region: env('AWS_REGION', 'us-east-1'),
    endpoint: process.env.SQS_ENDPOINT,
    credentials: {
      accessKeyId: env('AWS_ACCESS_KEY_ID', 'test'),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY', 'test'),
    },
  };
}

export function createApiAwsClients() {
  const ddbClient = createDynamoDbDocumentClient({
    region: env('AWS_REGION', 'us-east-1'),
    endpoint: process.env.DDB_ENDPOINT,
    credentials: {
      accessKeyId: env('AWS_ACCESS_KEY_ID', 'test'),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY', 'test'),
    },
  });

  const db = createDbAccess(ddbClient, {
    gameStateTableName: env('GAMESTATE_TABLE', 'GameState'),
    commandLogTableName: env('COMMANDLOG_TABLE', 'CommandLog'),
  });

  const sqs = new SQSClient(awsClientConfig());
  const queue: CommandQueue = {
    async sendMessage(input) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: input.queueUrl,
          MessageBody: input.messageBody,
          MessageGroupId: input.messageGroupId,
          MessageDeduplicationId: input.messageDeduplicationId,
        })
      );
    },
  };

  const queueUrl = env('COMMANDS_QUEUE_URL');

  return {
    db,
    queue,
    queueUrl,
  };
}
