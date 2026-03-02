export interface DevAuthInput {
  actorIdOverride?: string;
  env?: Record<string, string | undefined>;
}

export interface ResolvedDevAuth {
  actorId: string;
}

export function resolveDevAuth(input: DevAuthInput = {}): ResolvedDevAuth {
  const env = input.env ?? process.env;
  const actorId = input.actorIdOverride ?? env.DEV_ACTOR_ID ?? 'player-aaa';
  return { actorId };
}
