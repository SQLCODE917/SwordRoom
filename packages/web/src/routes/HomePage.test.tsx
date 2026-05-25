import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PublicGamesTable } from './HomePage';

describe('PublicGamesTable', () => {
  it('shows one dominant game action and reveals secondary actions on demand', () => {
    render(
      <MemoryRouter>
        <PublicGamesTable
          loading={false}
          emptyText="No public games found."
          rows={[
            {
              key: 'game-gm',
              gameName: 'GM Game',
              visibility: 'PUBLIC',
              phaseLabel: null,
              actions: {
                primary: {
                  kind: 'link',
                  key: 'game-gm:lobby',
                  label: 'Lobby',
                  to: '/games/game-gm',
                  disabled: false,
                  disabledReason: null,
                  variant: 'default',
                },
                secondary: [
                  {
                    kind: 'link',
                    key: 'game-gm:chat',
                    label: 'Chat',
                    to: '/games/game-gm/chat',
                    disabled: false,
                    disabledReason: null,
                    variant: 'default',
                  },
                  {
                    kind: 'link',
                    key: 'game-gm:gm-inbox',
                    label: 'Inbox',
                    to: '/inbox?mode=gm&gameId=game-gm',
                    disabled: false,
                    disabledReason: null,
                    variant: 'default',
                  },
                ],
                moreLabel: 'More Actions',
              },
            },
          ]}
        />
      </MemoryRouter>,
    );

    const row = screen.getByText('GM Game').closest('tr');
    expect(row).toBeTruthy();
    expect(
      within(row as HTMLElement).getByRole('link', { name: 'Lobby' }),
    ).toBeTruthy();
    expect(within(row as HTMLElement).getByText('More Actions')).toBeTruthy();

    fireEvent.click(within(row as HTMLElement).getByText('More Actions'));
    expect(within(row as HTMLElement).getByRole('link', { name: 'Chat' })).toBeTruthy();
    expect(
      within(row as HTMLElement).getByRole('link', { name: 'Inbox' }),
    ).toBeTruthy();
  });
});
