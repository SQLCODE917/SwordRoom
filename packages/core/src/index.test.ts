import { describe, expect, it } from 'vitest';
import { createHelloResponse, validateHelloRequest } from './index.js';

describe('core hello utilities', () => {
  it('creates a hello response from shared core type', () => {
    const result = createHelloResponse({ name: 'Ada' }, new Date('2024-01-01T00:00:00.000Z'));
    expect(result).toEqual({
      message: 'Hello, Ada!',
      source: 'core',
      timestamp: '2024-01-01T00:00:00.000Z',
    });
  });

  it('validates request input', () => {
    expect(validateHelloRequest({ name: '   ' })).toEqual([
      { field: 'name', message: 'name is required' },
    ]);
    expect(validateHelloRequest({ name: 'Grace' })).toEqual([]);
  });
});
