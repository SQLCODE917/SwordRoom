import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { idleCommandStatus, useCommandWorkflow } from '../hooks/useCommandStatus';
import { useGameActorContext } from '../hooks/useGameActorContext';
import { CharacterSheetPage } from './CharacterSheetPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
}));

vi.mock('../hooks/useGameActorContext', () => ({
  useGameActorContext: vi.fn(),
}));

vi.mock('../hooks/useCommandStatus', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useCommandStatus')>('../hooks/useCommandStatus');
  return {
    ...actual,
    useCommandWorkflow: vi.fn(),
  };
});

vi.mock('../logging/flowLog', () => ({
  logWebFlow: vi.fn(),
  summarizeError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}));

function createAuth(actorId = 'gm-zzz'): AuthProvider {
  return {
    mode: 'dev',
    actorId,
    isAuthenticated: true,
    pendingAction: null,
    errorMessage: null,
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: actorId }),
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
  };
}

describe('CharacterSheetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCommandWorkflow).mockReturnValue({
      status: idleCommandStatus,
      isRunning: false,
      resetStatus: vi.fn(),
      submitAndAwait: vi.fn(),
      submitEnvelopeAndAwait: vi.fn(),
    });
  });

  it('shows Remove from Game for GMs viewing another player character', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth('gm-zzz'));
    vi.mocked(useGameActorContext).mockReturnValue({
      context: {
        actorId: 'gm-zzz',
        displayName: 'GM',
        roles: ['PLAYER', 'GM'],
        gmPlayerId: 'gm-zzz',
        isGameMaster: true,
      },
      loading: false,
      error: null,
    });
    vi.mocked(createApiClient).mockReturnValue({
      getCharacter: vi.fn(async () => ({
        gameId: 'game-1',
        characterId: 'char-1',
        ownerPlayerId: 'player-aaa',
        status: 'APPROVED',
        draft: {
          race: 'HUMAN',
          raisedBy: null,
          subAbility: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 },
          ability: { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 },
          bonus: { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 },
          background: { kind: null, roll2d: null },
          starting: { expTotal: 0, expUnspent: 0, moneyGamels: 0, moneyRoll2d: null, startingSkills: [] },
          skills: [],
          purchases: { weapons: [], armor: [], shields: [], gear: [] },
          appearance: { imageKey: null, imageUrl: null, updatedAt: null },
          identity: { name: 'Hero', age: null, gender: null },
          noteToGm: null,
          gmNote: null,
        },
      })),
      getOwnedCharacter: vi.fn(async () => null),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter initialEntries={['/games/game-1/characters/char-1']}>
        <Routes>
          <Route path="/games/:gameId/characters/:characterId" element={<CharacterSheetPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: 'Remove from Game' })).toBeTruthy();
  });
});
