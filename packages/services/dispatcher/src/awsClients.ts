import { ReceiveMessageCommand, DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { createDbAccess, createDynamoDbDocumentClient, type QueueMessage } from '@starter/services-shared';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`missing env var ${name}`);
  }
  return value;
}

function hasEndpointOverride(endpoint: string | undefined): endpoint is string {
  return typeof endpoint === 'string' && endpoint.trim() !== '';
}

function localCredentials() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || 'test',
  };
}

function awsBaseConfig(endpoint: string | undefined) {
  const config: { region: string; endpoint?: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = {
    region: env('AWS_REGION', 'us-east-1'),
  };
  if (hasEndpointOverride(endpoint)) {
    config.endpoint = endpoint;
    config.credentials = localCredentials();
  }
  return config;
}

export function createDispatcherAwsClients() {
  const ddb = createDynamoDbDocumentClient(awsBaseConfig(process.env.DDB_ENDPOINT));

  const sqs = new SQSClient(awsBaseConfig(process.env.SQS_ENDPOINT));

  return {
    db: createDbAccess(ddb, {
      gameStateTableName: env('GAMESTATE_TABLE', 'GameState'),
      commandLogTableName: env('COMMANDLOG_TABLE', 'CommandLog'),
    }),
    sqs,
    queueUrl: env('COMMANDS_QUEUE_URL'),
  };
}

export async function receiveCommandMessages(
  sqs: SQSClient,
  queueUrl: string,
  maxNumberOfMessages = 10
): Promise<Array<Pick<QueueMessage, 'receiptHandle' | 'messageBody' | 'traceContext'>>> {
  const output = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxNumberOfMessages,
      WaitTimeSeconds: 10,
      MessageAttributeNames: ['All'],
      AttributeNames: ['All'],
    })
  );

  const messages: Array<Pick<QueueMessage, 'receiptHandle' | 'messageBody' | 'traceContext'>> = [];
  for (const msg of output.Messages ?? []) {
    if (!msg.ReceiptHandle || !msg.Body) {
      continue;
    }
    messages.push({
      receiptHandle: msg.ReceiptHandle,
      messageBody: msg.Body,
      traceContext: {
        apiRequestId: readMessageAttribute(msg.MessageAttributes?.ApiRequestId?.StringValue),
        clientSessionId: readMessageAttribute(msg.MessageAttributes?.ClientSessionId?.StringValue),
        clientRequestId: readMessageAttribute(msg.MessageAttributes?.ClientRequestId?.StringValue),
        xrayTraceHeader: readMessageAttribute(msg.Attributes?.AWSTraceHeader),
      },
    });
  }
  return messages;
}

export async function deleteCommandMessage(sqs: SQSClient, queueUrl: string, receiptHandle: string): Promise<void> {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    })
  );
}

function readMessageAttribute(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
