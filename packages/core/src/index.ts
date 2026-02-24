import type { HelloRequest, HelloResponse } from './types.js';
import { sanitizeName, validateHelloRequest } from './validation.js';

export type { HelloRequest, HelloResponse, ValidationError } from './types.js';
export { sanitizeName, validateHelloRequest };

export function createHelloResponse(request: HelloRequest, now: Date = new Date()): HelloResponse {
  const name = sanitizeName(request.name);
  return {
    message: `Hello, ${name}!`,
    source: 'core',
    timestamp: now.toISOString(),
  };
}
