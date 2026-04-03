import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createDbAccess, createDynamoDbDocumentClient, type CommandQueue } from '@starter/services-shared';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`missing env var ${name}`);
  }
  return value;
}

function region(): string {
  return env('AWS_REGION', 'us-east-1');
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

function awsConfigForEndpoint(endpoint: string | undefined) {
  const config: { region: string; endpoint?: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = {
    region: region(),
  };
  if (hasEndpointOverride(endpoint)) {
    config.endpoint = endpoint;
    config.credentials = localCredentials();
  }
  return config;
}

function s3ClientConfig(endpoint: string | undefined) {
  const config: S3ClientConfig = {
    region: region(),
  };
  if (hasEndpointOverride(endpoint)) {
    config.endpoint = endpoint;
    config.forcePathStyle = true;
    config.credentials = localCredentials();
    // Local S3-compatible endpoints such as LocalStack can reject presigned PUT URLs
    // that include optional flexible checksum query params.
    config.requestChecksumCalculation = 'WHEN_REQUIRED';
    config.responseChecksumValidation = 'WHEN_REQUIRED';
  }
  return config;
}

export function createApiAwsClients() {
  const ddbClient = createDynamoDbDocumentClient({
    ...awsConfigForEndpoint(process.env.DDB_ENDPOINT),
  });

  const db = createDbAccess(ddbClient, {
    gameStateTableName: env('GAMESTATE_TABLE', 'GameState'),
    commandLogTableName: env('COMMANDLOG_TABLE', 'CommandLog'),
  });

  const sqs = new SQSClient(awsConfigForEndpoint(process.env.SQS_ENDPOINT));
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
  const uploadsBucket = env('UPLOADS_BUCKET', 'swordworld-uploads');
  const s3Endpoint = process.env.S3_ENDPOINT ?? process.env.SQS_ENDPOINT;
  const s3PublicEndpoint = process.env.S3_PUBLIC_ENDPOINT ?? s3Endpoint;
  const s3 = new S3Client(s3ClientConfig(s3Endpoint));
  const s3Public = new S3Client(s3ClientConfig(s3PublicEndpoint));
  const uploads = {
    async headObject(key: string) {
      try {
        await s3.send(
          new HeadObjectCommand({
            Bucket: uploadsBucket,
            Key: key,
          })
        );
        return true;
      } catch (error) {
        if (isS3NotFound(error)) {
          return false;
        }
        throw error;
      }
    },
    async createSignedUploadUrl(input: { key: string; contentType: string; expiresInSeconds: number }) {
      return getSignedUrl(
        s3Public,
        new PutObjectCommand({
          Bucket: uploadsBucket,
          Key: input.key,
          ContentType: input.contentType,
        }),
        { expiresIn: input.expiresInSeconds }
      );
    },
    async createSignedDownloadUrl(input: { key: string; expiresInSeconds: number }) {
      return getSignedUrl(
        s3Public,
        new GetObjectCommand({
          Bucket: uploadsBucket,
          Key: input.key,
        }),
        { expiresIn: input.expiresInSeconds }
      );
    },
  };

  return {
    db,
    queue,
    queueUrl,
    uploads,
  };
}

function isS3NotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = (error as { name?: string }).name;
  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  return name === 'NotFound' || name === 'NoSuchKey' || metadata?.httpStatusCode === 404;
}
