import type { HelloRequest, HelloResponse } from './types.js';
import { sanitizeName, validateHelloRequest, helloRequestSchema } from './validation.js';

export type { HelloRequest, HelloResponse, ValidationError } from './types.js';
export { sanitizeName, validateHelloRequest, helloRequestSchema };

export function createHelloResponse(request: HelloRequest, now: Date = new Date()): HelloResponse {
  const name = sanitizeName(request.name);
  return {
    message: `Hello, ${name}!`,
    source: 'engine',
    timestamp: now.toISOString(),
  };
}
