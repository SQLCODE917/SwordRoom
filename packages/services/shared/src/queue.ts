import type { AnyCommandEnvelope } from '@starter/shared';

export interface QueueSendInput {
  queueUrl: string;
  messageBody: string;
  messageGroupId: string;
  messageDeduplicationId: string;
}

export interface QueueMessage {
  queueUrl: string;
  messageBody: string;
  messageGroupId: string;
  messageDeduplicationId: string;
  receiptHandle: string;
}

export interface CommandQueue {
  sendMessage(input: QueueSendInput): Promise<void>;
}

export interface QueueConsumer {
  receiveMessages(queueUrl: string, maxNumberOfMessages: number): Promise<QueueMessage[]>;
  deleteMessage(queueUrl: string, receiptHandle: string): Promise<void>;
}

export class InMemoryFifoQueue implements CommandQueue, QueueConsumer {
  private readonly messages: QueueMessage[] = [];
  private readonly seenDedupIds = new Set<string>();

  async sendMessage(input: QueueSendInput): Promise<void> {
    if (this.seenDedupIds.has(input.messageDeduplicationId)) {
      return;
    }

    this.seenDedupIds.add(input.messageDeduplicationId);
    this.messages.push({
      ...input,
      receiptHandle: `rh-${input.messageDeduplicationId}`,
    });
  }

  async receiveMessages(queueUrl: string, maxNumberOfMessages: number): Promise<QueueMessage[]> {
    const out: QueueMessage[] = [];
    for (const message of this.messages) {
      if (message.queueUrl !== queueUrl) {
        continue;
      }
      out.push(message);
      if (out.length >= maxNumberOfMessages) {
        break;
      }
    }
    return out;
  }

  async deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    const index = this.messages.findIndex(
      (message) => message.queueUrl === queueUrl && message.receiptHandle === receiptHandle
    );
    if (index >= 0) {
      this.messages.splice(index, 1);
    }
  }
}

export function makeSqsFifoSendInput(input: {
  queueUrl: string;
  envelope: AnyCommandEnvelope;
}): QueueSendInput {
  return {
    queueUrl: input.queueUrl,
    messageBody: JSON.stringify(input.envelope),
    messageGroupId: input.envelope.gameId,
    messageDeduplicationId: input.envelope.commandId,
  };
}
