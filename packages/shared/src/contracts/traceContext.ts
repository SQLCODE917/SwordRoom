export const TRACE_CONTEXT_HEADERS = {
  xrayTraceHeader: 'x-amzn-trace-id',
  clientSessionId: 'x-swordworld-client-session-id',
  clientRequestId: 'x-swordworld-client-request-id',
} as const;

export interface TraceRequestContext {
  xrayTraceHeader: string | null;
  clientSessionId: string | null;
  clientRequestId: string | null;
}

export interface CommandTraceContext extends TraceRequestContext {
  apiRequestId: string | null;
}

export function buildTraceRequestHeaders(context: TraceRequestContext): Record<string, string> {
  const headers: Record<string, string> = {};
  if (context.xrayTraceHeader) {
    headers[TRACE_CONTEXT_HEADERS.xrayTraceHeader] = context.xrayTraceHeader;
  }
  if (context.clientSessionId) {
    headers[TRACE_CONTEXT_HEADERS.clientSessionId] = context.clientSessionId;
  }
  if (context.clientRequestId) {
    headers[TRACE_CONTEXT_HEADERS.clientRequestId] = context.clientRequestId;
  }
  return headers;
}

export function readTraceRequestContext(
  headers: Readonly<Record<string, string | string[] | undefined>>
): TraceRequestContext {
  return {
    xrayTraceHeader: readHeader(headers, TRACE_CONTEXT_HEADERS.xrayTraceHeader),
    clientSessionId: readHeader(headers, TRACE_CONTEXT_HEADERS.clientSessionId),
    clientRequestId: readHeader(headers, TRACE_CONTEXT_HEADERS.clientRequestId),
  };
}

export function createCommandTraceContext(input: {
  requestId: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}): CommandTraceContext {
  const requestTrace = readTraceRequestContext(input.headers);
  return {
    ...requestTrace,
    apiRequestId: input.requestId,
  };
}

function readHeader(headers: Readonly<Record<string, string | string[] | undefined>>, name: string): string | null {
  const value = headers[name];
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].trim() !== '' ? value[0] : null;
  }
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
