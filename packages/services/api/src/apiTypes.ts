export interface ApiRoute {
  method: 'POST' | 'GET';
  path: string;
  auth: 'required' | 'gm_required';
}

export interface CommandStatusResponse {
  commandId: string;
  status: 'ACCEPTED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
}
