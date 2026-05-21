import { buildTraceRequestHeaders } from '@starter/shared';

const CLIENT_SESSION_STORAGE_KEY = 'swordworld.trace.clientSessionId';
let inMemoryClientSessionId: string | null = null;

export function readTraceRequestHeaders(): Record<string, string> {
  return buildTraceRequestHeaders({
    xrayTraceHeader: createXrayTraceHeader(),
    clientSessionId: readOrCreateClientSessionId(),
    clientRequestId: createRequestId(),
  });
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
