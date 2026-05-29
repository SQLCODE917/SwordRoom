import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PublicGamesTable } from './HomePage';

describe('PublicGamesTable', () => {
  it('shows public game status inline and keeps row actions visible', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
      screen.queryByRole('columnheader', { name: 'Visibility' }),
    ).not.toBeTruthy();
    expect(within(row as HTMLElement).getByText('PUBLIC')).toBeTruthy();
    expect(
      within(row as HTMLElement).getByRole('link', { name: 'Lobby' }),
    ).toBeTruthy();
    expect(within(row as HTMLElement).getByRole('link', { name: 'Chat' })).toBeTruthy();
    expect(
      within(row as HTMLElement).getByRole('link', { name: 'Inbox' }),
    ).toBeTruthy();
    expect(within(row as HTMLElement).queryByText('More Actions')).not.toBeTruthy();
  });
});
