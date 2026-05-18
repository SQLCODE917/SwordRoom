export interface DevAuthInput {
  actorIdOverride?: string;
  env?: Record<string, string | undefined>;
}

export interface ResolvedDevAuth {
  actorId: string;
}

export function resolveDevAuth(input: DevAuthInput = {}): ResolvedDevAuth {
  const actorId = input.actorIdOverride ?? input.env?.DEV_ACTOR_ID ?? 'player-aaa';
  return { actorId };
}
