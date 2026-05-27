import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PregamePlanningPanel } from './PregamePlanningPanel';

describe('PregamePlanningPanel', () => {
  it('renders prompt summary for a ready planning state', () => {
    const onClaimRole = vi.fn(async () => undefined);

    render(
      <PregamePlanningPanel
        planningState={{
          status: 'ready',
          gameId: 'game-1',
          planning: {
            gameId: 'game-1',
            gameName: 'Dungeon Delvers',
            viewer: {
              isMember: true,
              isGameMaster: false,
            },
            activePrompt: {
              promptId: 'prompt-1',
              title: 'Party needs Frontline',
              prompt: 'We still need Frontline. Please share a draft if you can cover it.',
              suggestedRoles: ['FRONTLINE'],
              senderDisplayName: '@Zed GM',
              createdAt: '2026-03-01T09:15:00.000Z',
            },
            recentClaims: [],
          },
        }}
        onClaimRole={onClaimRole}
      />
    );

    expect(screen.getByText('@Zed GM: We still need Frontline. Please share a draft if you can cover it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Claim Frontline' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Claim Healer' })).toBeTruthy();
  });
});
