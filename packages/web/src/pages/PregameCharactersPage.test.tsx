import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { PregameCharactersPage } from './PregameCharactersPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
}));

vi.mock('../logging/flowLog', () => ({
  logWebFlow: vi.fn(),
  summarizeError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}));

function createAuth(): AuthProvider {
  return {
    mode: 'dev',
    actorId: 'player-1',
    isAuthenticated: true,
    pendingAction: null,
    errorMessage: null,
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-1' }),
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
  };
}

describe('PregameCharactersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mine, shared, and approved views for a game-scoped workbench', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(createApiClient).mockReturnValue({
      getGame: vi.fn(async () => ({
        gameId: 'game-1',
        name: 'Dungeon Delvers',
        visibility: 'PUBLIC',
        gmPlayerId: 'gm-1',
        version: 1,
      })),
      getMyCharacters: vi.fn(async () => [
        {
          gameId: 'game-1',
          characterId: 'char-1',
          ownerPlayerId: 'player-1',
          status: 'DRAFT',
          draft: {
            identity: { name: 'Borin Stonehand' },
          },
        },
      ]),
      getGameChat: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [
          { playerId: 'player-1', displayName: 'Borin', role: 'PLAYER', characterId: 'char-1' },
          { playerId: 'player-2', displayName: 'Alice', role: 'PLAYER', characterId: 'char-2' },
        ],
        messages: [
          {
            messageId: 'msg-1',
            senderPlayerId: 'player-2',
            senderDisplayName: 'Alice',
            senderRole: 'PLAYER',
            senderCharacterId: 'char-2',
            body: 'Sharing my healer draft.',
            artifact: {
              kind: 'CHARACTER_DRAFT',
              characterId: 'char-2',
              snapshotVersion: 3,
              characterName: 'Aline',
              race: 'ELF',
              status: 'DRAFT',
              shareIntent: 'COMPARE_DIRECTIONS',
              contextNote: 'Option A stays Priest-heavy. Option B shifts into frontline support.',
              abilitySummary: ['INT 17'],
              skillSummary: ['Priest 2'],
            },
            createdAt: '2026-03-01T09:15:00.000Z',
          },
          {
            messageId: 'msg-2',
            senderPlayerId: 'player-1',
            senderDisplayName: 'Borin',
            senderRole: 'PLAYER',
            senderCharacterId: 'char-1',
            body: 'Looks good to me.',
            createdAt: '2026-03-01T09:16:00.000Z',
          },
          {
            messageId: 'msg-3',
            senderPlayerId: 'player-1',
            senderDisplayName: 'Borin',
            senderRole: 'PLAYER',
            senderCharacterId: 'char-1',
            body: 'Reaction: Party fit',
            artifact: {
              kind: 'CHARACTER_DRAFT_REACTION',
              targetMessageId: 'msg-1',
              characterId: 'char-2',
              snapshotVersion: 3,
              characterName: 'Aline',
              reaction: 'PARTY_FIT',
            },
            createdAt: '2026-03-01T09:17:00.000Z',
          },
        ],
      })),
      getCharacter: vi
        .fn()
        .mockImplementation(async (_gameId: string, characterId: string) =>
          characterId === 'char-1'
            ? {
                gameId: 'game-1',
                characterId: 'char-1',
                ownerPlayerId: 'player-1',
                status: 'DRAFT',
                draft: { identity: { name: 'Borin Stonehand' } },
              }
            : {
                gameId: 'game-1',
                characterId: 'char-2',
                ownerPlayerId: 'player-2',
                status: 'APPROVED',
                draft: { identity: { name: 'Aline' } },
              }
        ),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter initialEntries={['/games/game-1/characters']}>
        <Routes>
          <Route path="/games/:gameId/characters" element={<PregameCharactersPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Characters Workbench' })).toBeTruthy();
    const workflow = screen.getByRole('navigation', { name: 'Pregame workflow' });
    expect(within(workflow).getByRole('link', { name: 'Characters' }).getAttribute('href')).toBe('/games/game-1/characters');

    const mineTable = screen.getByRole('table', { name: 'Characters workbench mine' });
    expect(within(mineTable).getByText('Borin Stonehand')).toBeTruthy();
    expect(within(mineTable).getByText('Not shared yet')).toBeTruthy();
    expect(within(mineTable).getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(
      '/games/game-1/characters/char-1/edit?entry=characters&focus=review'
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Shared (1)' }));
    const sharedTable = await screen.findByRole('table', { name: 'Characters workbench shared' });
    expect(screen.getByText('1 shared draft is asking the table to compare directions.')).toBeTruthy();
    expect(within(sharedTable).getByText('Aline')).toBeTruthy();
    expect(within(sharedTable).getByText('Snapshot v3 · DRAFT')).toBeTruthy();
    expect(within(sharedTable).getByText('1 follow-up message · 1 reaction')).toBeTruthy();
    expect(within(sharedTable).getByRole('link', { name: 'Discuss' }).getAttribute('href')).toBe(
      '/games/game-1/chat?artifact=msg-1&draft=About+Aline+v3%3A+'
    );
    expect(await screen.findByRole('heading', { name: 'Aline Preview' })).toBeTruthy();
    expect(screen.getByText('Compare directions')).toBeTruthy();
    expect(screen.getByText('Option A stays Priest-heavy. Option B shifts into frontline support.')).toBeTruthy();
    expect(screen.getByText('Reactions: Party fit 1')).toBeTruthy();
    expect(screen.getByText('INT 17')).toBeTruthy();
    expect(screen.getByText('Skills: Priest 2')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Continue Discussion' }).getAttribute('href')).toBe(
      '/games/game-1/chat?artifact=msg-1&draft=About+Aline+v3%3A+'
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Approved (1)' }));
    const approvedTable = await screen.findByRole('table', { name: 'Characters workbench approved' });
    expect(within(approvedTable).getByText('Aline')).toBeTruthy();
    expect(within(approvedTable).getByText('player-2')).toBeTruthy();
    expect(within(approvedTable).getByText('APPROVED')).toBeTruthy();
  });

  it('opens the shared review tab directly when a shared row key is requested', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(createApiClient).mockReturnValue({
      getGame: vi.fn(async () => ({
        gameId: 'game-1',
        name: 'Dungeon Delvers',
        visibility: 'PUBLIC',
        gmPlayerId: 'gm-1',
        version: 1,
      })),
      getMyCharacters: vi.fn(async () => []),
      getGameChat: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [{ playerId: 'player-2', displayName: 'Alice', role: 'PLAYER', characterId: 'char-2' }],
        messages: [
          {
            messageId: 'msg-1',
            senderPlayerId: 'player-2',
            senderDisplayName: 'Alice',
            senderRole: 'PLAYER',
            senderCharacterId: 'char-2',
            body: 'Sharing my healer draft.',
            artifact: {
              kind: 'CHARACTER_DRAFT',
              characterId: 'char-2',
              snapshotVersion: 3,
              characterName: 'Aline',
              race: 'ELF',
              status: 'DRAFT',
              shareIntent: 'COMPARE_DIRECTIONS',
              contextNote: 'Option A stays Priest-heavy. Option B shifts into frontline support.',
              abilitySummary: ['INT 17'],
              skillSummary: ['Priest 2'],
            },
            createdAt: '2026-03-01T09:15:00.000Z',
          },
        ],
      })),
      getCharacter: vi.fn(async () => ({
        gameId: 'game-1',
        characterId: 'char-2',
        ownerPlayerId: 'player-2',
        status: 'DRAFT',
        draft: { identity: { name: 'Aline' } },
      })),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter initialEntries={['/games/game-1/characters?shared=msg-1']}>
        <Routes>
          <Route path="/games/:gameId/characters" element={<PregameCharactersPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('table', { name: 'Characters workbench shared' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Aline Preview' })).toBeTruthy();
  });
});
