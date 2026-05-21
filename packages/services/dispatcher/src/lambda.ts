import { logServiceFlow, summarizeCommandEnvelope, summarizeError } from '@starter/services-shared';
import { createDispatcherAwsClients } from './awsClients.js';
import { createDispatcher } from './index.js';

interface SqsLambdaRecord {
  messageId: string;
  body: string;
  attributes?: {
    AWSTraceHeader?: string;
  };
  messageAttributes?: Record<
    string,
    {
      stringValue?: string;
    }
  >;
}

interface SqsLambdaEvent {
  Records?: SqsLambdaRecord[];
}

interface SqsBatchResponse {
  batchItemFailures: Array<{ itemIdentifier: string }>;
}

const clients = createDispatcherAwsClients();
const dispatcher = createDispatcher({ db: clients.db });
const flowLogEnabled = process.env.FLOW_LOG === '1';

export async function handler(event: SqsLambdaEvent): Promise<SqsBatchResponse> {
  logFlow('DISPATCHER_LAMBDA_BATCH_START', { count: event.Records?.length ?? 0 });
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records ?? []) {
    try {
      const envelope = JSON.parse(record.body);
      logFlow('DISPATCHER_LAMBDA_MESSAGE_RECEIVED', {
        messageId: record.messageId,
        apiRequestId: readAttribute(record.messageAttributes?.ApiRequestId?.stringValue),
        clientSessionId: readAttribute(record.messageAttributes?.ClientSessionId?.stringValue),
        clientRequestId: readAttribute(record.messageAttributes?.ClientRequestId?.stringValue),
        xrayTraceHeader: readAttribute(record.attributes?.AWSTraceHeader),
        ...summarizeCommandEnvelope(envelope),
      });

      const result = await dispatcher.dispatch(envelope, {
        traceContext: {
          apiRequestId: readAttribute(record.messageAttributes?.ApiRequestId?.stringValue),
          clientSessionId: readAttribute(record.messageAttributes?.ClientSessionId?.stringValue),
          clientRequestId: readAttribute(record.messageAttributes?.ClientRequestId?.stringValue),
          xrayTraceHeader: readAttribute(record.attributes?.AWSTraceHeader),
        },
      });
      logFlow('DISPATCHER_LAMBDA_MESSAGE_RESULT', {
        messageId: record.messageId,
        apiRequestId: readAttribute(record.messageAttributes?.ApiRequestId?.stringValue),
        clientSessionId: readAttribute(record.messageAttributes?.ClientSessionId?.stringValue),
        clientRequestId: readAttribute(record.messageAttributes?.ClientRequestId?.stringValue),
        xrayTraceHeader: readAttribute(record.attributes?.AWSTraceHeader),
        ...summarizeCommandEnvelope(envelope),
        outcome: result.outcome,
        errorCode: result.errorCode ?? null,
      });
    } catch (error) {
      logFlow('DISPATCHER_LAMBDA_MESSAGE_ERROR', {
        messageId: record.messageId,
        ...summarizeError(error),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

function readAttribute(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function logFlow(event: string, data: Record<string, unknown>): void {
  logServiceFlow({
    enabled: flowLogEnabled,
    service: 'dispatcher',
    event,
    data,
  });
}
