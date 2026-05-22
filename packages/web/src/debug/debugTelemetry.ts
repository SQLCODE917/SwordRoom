import { readTraceSnapshot } from '../logging/requestTraceContext';

type DebugLogCategory =
  | 'command-status'
  | 'status-region'
  | 'network'
  | 'console-error';
type DebugLogLevel = 'info' | 'error';

export interface DebugLogEntry {
  id: string;
  ts: string;
  category: DebugLogCategory;
  level: DebugLogLevel;
  message: string;
  details: string;
}

export interface DebugTraceSnapshot {
  clientSessionId: string | null;
  latestClientRequestId: string | null;
  latestXrayTraceHeader: string | null;
}

export interface DebugStatusRegionSnapshot {
  capturedAt: string;
  pageStatusText: string;
  identityStatusText: string;
  errorText: string | null;
}

export interface DebugCommandStatusSnapshot {
  capturedAt: string;
  state: string;
  message: string;
  commandId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface DebugTelemetryState {
  trace: DebugTraceSnapshot;
  statusRegion: DebugStatusRegionSnapshot | null;
  commandStatus: DebugCommandStatusSnapshot | null;
  logs: DebugLogEntry[];
}

type Listener = () => void;

const MAX_LOG_ENTRIES = 400;
const listeners = new Set<Listener>();

let state: DebugTelemetryState = {
  trace: readTraceSnapshot(),
  statusRegion: null,
  commandStatus: null,
  logs: [],
};

let captureInstallCount = 0;
let restoreCapture: (() => void) | null = null;
let nextLogId = 1;
let lastCommandStatusKey = '';
let lastStatusRegionKey = '';
let consoleEmitScheduled = false;

export function subscribeDebugTelemetry(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readDebugTelemetryState(): DebugTelemetryState {
  return state;
}

export function installDebugTelemetryCapture(): () => void {
  captureInstallCount += 1;
  if (captureInstallCount === 1) {
    restoreCapture = installCaptureOnce();
  }

  return () => {
    captureInstallCount = Math.max(0, captureInstallCount - 1);
    if (captureInstallCount === 0 && restoreCapture) {
      restoreCapture();
      restoreCapture = null;
    }
  };
}

export function reportDebugStatusRegion(snapshot: {
  pageStatusText: string;
  identityStatusText: string;
  errorText: string | null;
}): void {
  const key = [
    snapshot.pageStatusText,
    snapshot.identityStatusText,
    snapshot.errorText ?? '',
  ].join('|');
  if (key === lastStatusRegionKey) {
    return;
  }
  lastStatusRegionKey = key;

  const capturedAt = new Date().toISOString();
  state = {
    ...state,
    statusRegion: {
      capturedAt,
      pageStatusText: snapshot.pageStatusText,
      identityStatusText: snapshot.identityStatusText,
      errorText: snapshot.errorText,
    },
  };
  pushLog({
    category: 'status-region',
    level: snapshot.errorText ? 'error' : 'info',
    message: snapshot.errorText ? 'statusRegion error updated' : 'statusRegion updated',
    details: [
      `pageStatus=${snapshot.pageStatusText}`,
      `identity=${snapshot.identityStatusText}`,
      `error=${snapshot.errorText ?? 'none'}`,
    ].join(' | '),
    emit: false,
  });
  emit();
}

export function reportDebugCommandStatus(status: {
  state: string;
  message: string;
  commandId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}): void {
  const key = [
    status.state,
    status.message,
    status.commandId ?? '',
    status.errorCode ?? '',
    status.errorMessage ?? '',
  ].join('|');
  if (key === lastCommandStatusKey) {
    return;
  }
  lastCommandStatusKey = key;

  const capturedAt = new Date().toISOString();
  state = {
    ...state,
    commandStatus: {
      capturedAt,
      state: status.state,
      message: status.message,
      commandId: status.commandId,
      errorCode: status.errorCode,
      errorMessage: status.errorMessage,
    },
  };
  pushLog({
    category: 'command-status',
    level: status.state === 'Failed' ? 'error' : 'info',
    message: `Command status: ${status.state}`,
    details: [
      `commandId=${status.commandId ?? 'none'}`,
      `message=${status.message}`,
      `errorCode=${status.errorCode ?? 'none'}`,
      `errorMessage=${status.errorMessage ?? 'none'}`,
    ].join(' | '),
    emit: false,
  });
  emit();
}

function installCaptureOnce(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const restoreFetch = installFetchCapture(window);
  const restoreConsole = installConsoleCapture();
  const restoreWindowErrors = installWindowErrorCapture(window);

  return () => {
    restoreWindowErrors();
    restoreConsole();
    restoreFetch();
  };
}

function installFetchCapture(windowRef: Window): () => void {
  const originalFetch = windowRef.fetch.bind(windowRef);

  windowRef.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const method = readRequestMethod(input, init);
    const url = readRequestUrl(input);
    const startedAt = Date.now();
    refreshTraceSnapshot();

    try {
      const response = await originalFetch(input, init);
      refreshTraceSnapshot();
      const durationMs = Date.now() - startedAt;
      pushLog({
        category: 'network',
        level: response.ok ? 'info' : 'error',
        message: `${method} ${url} -> ${response.status}`,
        details: `statusText=${response.statusText || 'none'} | durationMs=${durationMs}`,
      });
      return response;
    } catch (error) {
      refreshTraceSnapshot();
      const durationMs = Date.now() - startedAt;
      pushLog({
        category: 'network',
        level: 'error',
        message: `${method} ${url} -> request failed`,
        details: `durationMs=${durationMs} | error=${toErrorMessage(error)}`,
      });
      throw error;
    }
  };

  return () => {
    windowRef.fetch = originalFetch;
  };
}

function installConsoleCapture(): () => void {
  const originalError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    pushLog({
      category: 'console-error',
      level: 'error',
      message: 'console.error',
      details: args.map((value) => serializeDebugValue(value)).join(' | '),
      emit: false,
    });
    scheduleConsoleEmit();
    originalError(...args);
  };

  return () => {
    console.error = originalError;
  };
}

function scheduleConsoleEmit(): void {
  if (consoleEmitScheduled) {
    return;
  }
  consoleEmitScheduled = true;
  queueMicrotask(() => {
    consoleEmitScheduled = false;
    emit();
  });
}

function installWindowErrorCapture(windowRef: Window): () => void {
  const onWindowError = (event: ErrorEvent) => {
    pushLog({
      category: 'console-error',
      level: 'error',
      message: 'window.onerror',
      details: [
        `message=${event.message || 'none'}`,
        `source=${event.filename || 'none'}`,
        `line=${event.lineno || 0}`,
        `column=${event.colno || 0}`,
      ].join(' | '),
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    pushLog({
      category: 'console-error',
      level: 'error',
      message: 'unhandledrejection',
      details: serializeDebugValue(event.reason),
    });
  };

  windowRef.addEventListener('error', onWindowError);
  windowRef.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    windowRef.removeEventListener('error', onWindowError);
    windowRef.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}

function readRequestMethod(
  input: RequestInfo | URL,
  init?: RequestInit,
): string {
  if (init?.method && init.method.trim() !== '') {
    return init.method.toUpperCase();
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (typeof URL !== 'undefined' && input instanceof URL) {
    return input.toString();
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.url;
  }
  return String(input);
}

function pushLog(input: {
  category: DebugLogCategory;
  level: DebugLogLevel;
  message: string;
  details: string;
  emit?: boolean;
}): void {
  const entry: DebugLogEntry = {
    id: `dbg-${nextLogId++}`,
    ts: new Date().toISOString(),
    category: input.category,
    level: input.level,
    message: input.message,
    details: input.details,
  };

  state = {
    ...state,
    logs: [entry, ...state.logs].slice(0, MAX_LOG_ENTRIES),
  };
  if (input.emit !== false) {
    emit();
  }
}

function refreshTraceSnapshot(): void {
  state = {
    ...state,
    trace: readTraceSnapshot(),
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function serializeDebugValue(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
