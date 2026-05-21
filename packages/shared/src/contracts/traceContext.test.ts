import { describe, expect, it } from 'vitest';
import {
  buildTraceRequestHeaders,
  createCommandTraceContext,
  readTraceRequestContext,
} from './traceContext.js';

describe('traceContext', () => {
  it('round-trips request trace headers', () => {
    const headers = buildTraceRequestHeaders({
      xrayTraceHeader: 'Root=1-682e307d-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=1',
      clientSessionId: 'browser-session-1',
      clientRequestId: 'browser-request-1',
    });

    expect(readTraceRequestContext(headers)).toEqual({
      xrayTraceHeader: 'Root=1-682e307d-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=1',
      clientSessionId: 'browser-session-1',
      clientRequestId: 'browser-request-1',
    });
  });

  it('creates a command trace context by combining request headers and API request id', () => {
    expect(
      createCommandTraceContext({
        requestId: 'api-req-1',
        headers: {
          'x-amzn-trace-id': 'Root=1-682e307d-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=1',
          'x-swordworld-client-session-id': 'browser-session-1',
          'x-swordworld-client-request-id': 'browser-request-1',
        },
      })
    ).toEqual({
      apiRequestId: 'api-req-1',
      xrayTraceHeader: 'Root=1-682e307d-0123456789abcdef01234567;Parent=0123456789abcdef;Sampled=1',
      clientSessionId: 'browser-session-1',
      clientRequestId: 'browser-request-1',
    });
  });
});
