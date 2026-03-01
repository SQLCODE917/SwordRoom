import type { HelloRequest, ValidationError } from './types.js';

export const helloRequestSchema = {
  safeParse(input: Partial<HelloRequest>) {
    const name = typeof input.name === 'string' ? sanitizeName(input.name) : '';
    if (!name) {
      return {
        success: false as const,
        error: {
          issues: [{ path: ['name'], message: 'name is required' }],
        },
      };
    }

    return {
      success: true as const,
      data: { name },
    };
  },
};

export function sanitizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateHelloRequest(input: Partial<HelloRequest>): ValidationError[] {
  const result = helloRequestSchema.safeParse({ name: input.name });
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'name',
    message: issue.message,
  }));
}
