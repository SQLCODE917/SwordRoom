export interface HelloRequest {
  name: string;
}

export interface HelloResponse {
  message: string;
  source: 'core';
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
}
