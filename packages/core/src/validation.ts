import type { HelloRequest, ValidationError } from './types.js';

export function sanitizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateHelloRequest(input: Partial<HelloRequest>): ValidationError[] {
  const errors: ValidationError[] = [];
  const name = typeof input.name === 'string' ? sanitizeName(input.name) : '';

  if (!name) {
    errors.push({ field: 'name', message: 'name is required' });
  }

  return errors;
}
