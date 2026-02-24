import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHello } from './api';

describe('fetchHello', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('calls server and returns typed response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        message: 'Hello, Lin!',
        source: 'core',
        timestamp: '2024-01-01T00:00:00.000Z',
      }),
    });

    const result = await fetchHello({ name: 'Lin' });

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3000/api/hello?name=Lin');
    expect(result.message).toBe('Hello, Lin!');
    expect(result.source).toBe('core');
  });

  it('throws on non-200 response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });

    await expect(fetchHello({ name: 'Lin' })).rejects.toThrow('Failed to fetch hello response');
  });
});
