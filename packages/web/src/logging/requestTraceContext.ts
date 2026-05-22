import { buildTraceRequestHeaders } from '@starter/shared';

const CLIENT_SESSION_STORAGE_KEY = 'swordworld.trace.clientSessionId';
let inMemoryClientSessionId: string | null = null;
let latestTraceSnapshot: {
  xrayTraceHeader: string | null;
  clientRequestId: string | null;
} = {
  xrayTraceHeader: null,
  clientRequestId: null,
};

export function readTraceRequestHeaders(): Record<string, string> {
  const xrayTraceHeader = createXrayTraceHeader();
  const clientRequestId = createRequestId();
  latestTraceSnapshot = {
    xrayTraceHeader,
    clientRequestId,
  };

  return buildTraceRequestHeaders({
    xrayTraceHeader,
    clientSessionId: readOrCreateClientSessionId(),
    clientRequestId,
  });
}

export function readTraceSnapshot(): {
  clientSessionId: string | null;
  latestClientRequestId: string | null;
  latestXrayTraceHeader: string | null;
} {
  return {
    clientSessionId: readOrCreateClientSessionId(),
    latestClientRequestId: latestTraceSnapshot.clientRequestId,
    latestXrayTraceHeader: latestTraceSnapshot.xrayTraceHeader,
  };
}

function readOrCreateClientSessionId(): string {
  if (typeof window === 'undefined') {
    if (!inMemoryClientSessionId) {
      inMemoryClientSessionId = createRequestId();
    }
    return inMemoryClientSessionId;
  }

  try {
    const existing = window.sessionStorage.getItem(CLIENT_SESSION_STORAGE_KEY);
    if (existing && existing.trim() !== '') {
      return existing;
    }
    const next = createRequestId();
    window.sessionStorage.setItem(CLIENT_SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    if (!inMemoryClientSessionId) {
      inMemoryClientSessionId = createRequestId();
    }
    return inMemoryClientSessionId;
  }
}

function createXrayTraceHeader(): string {
  const epochSecondsHex = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0')
    .slice(-8);
  const rootSuffix = randomHex(24);
  const parentId = randomHex(16);
  return `Root=1-${epochSecondsHex}-${rootSuffix};Parent=${parentId};Sampled=1`;
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`;
}

function randomHex(length: number): string {
  let out = '';
  while (out.length < length) {
    out += createRequestIdSeed();
  }
  return out.slice(0, length);
}

function createRequestIdSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16);
}
