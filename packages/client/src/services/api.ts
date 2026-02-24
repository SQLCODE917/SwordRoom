import type { HelloRequest } from '@starter/core';
import type { GetHelloResponse } from '@starter/server/types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api';

export async function fetchHello(input: HelloRequest): Promise<GetHelloResponse> {
  const params = new URLSearchParams({ name: input.name });
  const response = await fetch(`${API_BASE}/hello?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch hello response');
  }

  return response.json();
}
