export interface HelloRequest {
  name: string;
}

export interface HelloResponse {
  message: string;
  source: 'engine';
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
}
