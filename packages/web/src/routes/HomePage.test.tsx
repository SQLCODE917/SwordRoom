import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PublicGamesTable } from './HomePage';

describe('PublicGamesTable', () => {
  it('shows public game status inline and renders direct actions for single-action rows', () => {
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
                secondary: [],
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
    expect(screen.queryByRole('columnheader', { name: 'Game' })).toBeNull();
    expect(within(row as HTMLElement).getByText('PUBLIC')).toBeTruthy();
    expect(
      within(row as HTMLElement).getByRole('link', { name: 'Lobby' }),
    ).toBeTruthy();
    expect(within(row as HTMLElement).queryByRole('tablist')).toBeNull();
    expect(within(row as HTMLElement).queryByRole('tab', { name: 'Actions' })).toBeNull();
    expect(within(row as HTMLElement).queryByRole('link', { name: 'Chat' })).toBeNull();
    expect(
      within(row as HTMLElement).queryByRole('link', { name: 'Inbox' }),
    ).toBeNull();
  });
});
