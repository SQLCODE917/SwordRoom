import { describe, expect, it } from 'vitest';
import { InMemoryFifoQueue, makeSqsFifoSendInput } from './queue.js';

describe('queue', () => {
  it('preserves trace context through the in-memory FIFO queue', async () => {
    const queue = new InMemoryFifoQueue();

    await queue.sendMessage({
      queueUrl: 'commands.fifo',
      messageBody: '{"commandId":"cmd-1"}',
      messageGroupId: 'game-1',
      messageDeduplicationId: 'cmd-1',
      traceContext: {
        apiRequestId: 'api-req-1',
        xrayTraceHeader: 'Root=1-682e307d-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=1',
        clientSessionId: 'browser-session-1',
        clientRequestId: 'browser-request-1',
      },
    });

    const messages = await queue.receiveMessages('commands.fifo', 10);
    expect(messages[0]?.traceContext).toEqual({
      apiRequestId: 'api-req-1',
      xrayTraceHeader: 'Root=1-682e307d-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=1',
      clientSessionId: 'browser-session-1',
      clientRequestId: 'browser-request-1',
    });
  });

  it('builds FIFO send input with a trace context when present', () => {
    expect(
      makeSqsFifoSendInput({
        queueUrl: 'commands.fifo',
        envelope: {
          commandId: 'cmd-1',
          gameId: 'game-1',
          actorId: 'player-1',
          type: 'CreateCharacterDraft',
          schemaVersion: 1,
          createdAt: '2026-05-21T00:00:00.000Z',
          payload: {
            characterId: 'char-1',
            race: 'HUMAN',
            raisedBy: null,
          },
        },
        traceContext: {
          apiRequestId: 'api-req-1',
          xrayTraceHeader: 'Root=1-682e307d-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=1',
          clientSessionId: 'browser-session-1',
          clientRequestId: 'browser-request-1',
        },
      })
    ).toEqual({
      queueUrl: 'commands.fifo',
      messageBody:
        '{"commandId":"cmd-1","gameId":"game-1","actorId":"player-1","type":"CreateCharacterDraft","schemaVersion":1,"createdAt":"2026-05-21T00:00:00.000Z","payload":{"characterId":"char-1","race":"HUMAN","raisedBy":null}}',
      messageGroupId: 'game-1',
      messageDeduplicationId: 'cmd-1',
      traceContext: {
        apiRequestId: 'api-req-1',
        xrayTraceHeader: 'Root=1-682e307d-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=1',
        clientSessionId: 'browser-session-1',
        clientRequestId: 'browser-request-1',
      },
    });
  });
});
