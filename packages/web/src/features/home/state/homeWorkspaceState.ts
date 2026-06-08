export type HomeTabId = 'my-games' | 'public-games' | 'your-characters';

export interface HomeWorkspaceState {
  activeTab: HomeTabId;
}

export function resolveHomeWorkspaceState(input: {
  requestedTab: HomeTabId | null;
  hasJoinedGames: boolean;
}): HomeWorkspaceState {
  return {
    activeTab:
      input.requestedTab ??
      (input.hasJoinedGames ? 'my-games' : 'public-games'),
  };
}
