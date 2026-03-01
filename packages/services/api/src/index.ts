import type { ApiRoute } from './apiTypes.js';

export const contractRoutes: ApiRoute[] = [
  { method: 'POST', path: '/commands', auth: 'required' },
  { method: 'GET', path: '/commands/{commandId}', auth: 'required' },
  { method: 'GET', path: '/me/inbox', auth: 'required' },
  { method: 'GET', path: '/games/{gameId}/characters/{characterId}', auth: 'required' },
  { method: 'GET', path: '/gm/{gameId}/inbox', auth: 'gm_required' },
];

export function listContractRoutes(): ApiRoute[] {
  return [...contractRoutes];
}
