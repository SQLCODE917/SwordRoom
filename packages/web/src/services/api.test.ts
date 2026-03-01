import { describe, expect, it } from 'vitest';
import { getApiBase } from './api';

describe('web api config', () => {
  it('uses default API base', () => {
    expect(getApiBase()).toBe('/api');
  });
});
