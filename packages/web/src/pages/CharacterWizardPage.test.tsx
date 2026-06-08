import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { CharacterWizardPage } from './CharacterWizardPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
}));

vi.mock('../hooks/useCommandStatus', () => ({
  useCommandWorkflow: vi.fn(),
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

describe('CharacterWizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(useCommandWorkflow).mockReturnValue({
      status: {
        state: 'Idle',
        commandId: null,
        message: 'No command submitted yet.',
        errorCode: null,
        errorMessage: null,
      },
      isRunning: false,
      resetStatus: vi.fn(),
      submitAndAwait: vi.fn(),
      submitEnvelopeAndAwait: vi.fn(),
    });
  });

  it('allows a game-scoped draft route for a private invited game and shows planning focus', async () => {
    const postPregameObservationSession = vi.fn(async () => undefined);
    vi.mocked(createApiClient).mockReturnValue({
      getGame: vi.fn(async () => ({
        gameId: 'game-private',
        name: 'Private Delve',
        visibility: 'PRIVATE',
        gmPlayerId: 'gm-1',
        version: 1,
      })),
      getMyCharacters: vi.fn(async () => []),
      getCharacter: vi.fn(async () => ({
        characterId: 'char-1',
        gameId: 'game-private',
        ownerPlayerId: 'player-1',
        version: 1,
        status: 'DRAFT',
        name: 'Mira',
        race: 'HUMAN',
        subAbility: { A: 10, B: 10, C: 10, D: 10, E: 10, F: 10, G: 10, H: 10 },
        skillLevels: [],
        noteToGm: null,
        gmNote: null,
        startedAt: null,
        background: {
          family: null,
          status: null,
          statusSkill: null,
          statusBodyEnhancement: null,
        },
        abilities: {
          technique: 0,
          body: 0,
          heart: 0,
        },
        money: {
          starting: 0,
          remaining: 0,
        },
        inventory: {
          weapons: [],
          armor: [],
          shields: [],
          gear: [],
        },
        identity: {
          age: null,
          gender: null,
          faith: null,
          heightCm: null,
          weightKg: null,
          hairColor: null,
          eyeColor: null,
          skinTone: null,
        },
        appearanceImage: null,
      })),
      getPregamePlanning: vi.fn(async () => ({
        gameId: 'game-private',
        gameName: 'Private Delve',
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
      })),
      postPregameObservationSession,
    } as unknown as ReturnType<typeof createApiClient>);

    const view = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/games/game-private/character/new?entry=lobby&focus=role']}>
        <Routes>
          <Route path="/games/:gameId/character/new" element={<CharacterWizardPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Character Wizard' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Planning Focus' })).toBeTruthy();
    expect(screen.getByText('Draft toward Frontline')).toBeTruthy();
    expect(screen.getByText('Opened from Lobby so the game need stays visible while you draft.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back To Lobby' }).getAttribute('href')).toBe('/games/game-private');
    expect(screen.queryByRole('button', { name: 'Autofill from fixture' })).toBeNull();
    const savedCharacterSelect = screen.getByLabelText('Autofill from saved character');
    expect(screen.getByRole('option', { name: 'Ducard Sample II (DRAFT)' })).toBeTruthy();
    fireEvent.change(savedCharacterSelect, { target: { value: 'ducard-sample-ii' } });
    expect(screen.getByDisplayValue('Ducard Sample II')).toBeTruthy();
    expect(screen.queryByText('Route validation failed.')).toBeNull();
    expect(screen.queryByText(/Create or revise a character inside this game's pregame planning loop\./)).toBeNull();

    view.unmount();
    await waitFor(() =>
      expect(postPregameObservationSession).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({
            entrySource: 'lobby',
            entryFocus: 'role',
            wizardMode: 'apply',
            draftMode: 'new',
            gameId: 'game-private',
          }),
        })
      )
    );
  });

  it('shows a digest return action when creator re-entry comes from pregame digest', async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getGame: vi.fn(async () => ({
        gameId: 'game-private',
        name: 'Private Delve',
        visibility: 'PRIVATE',
        gmPlayerId: 'gm-1',
        version: 1,
      })),
      getMyCharacters: vi.fn(async () => []),
      getCharacter: vi.fn(async () => ({
        characterId: 'char-1',
        gameId: 'game-private',
        ownerPlayerId: 'player-1',
        version: 1,
        status: 'DRAFT',
        name: 'Mira',
        race: 'HUMAN',
        subAbility: { A: 10, B: 10, C: 10, D: 10, E: 10, F: 10, G: 10, H: 10 },
        skillLevels: [],
        noteToGm: null,
        gmNote: null,
        startedAt: null,
        background: {
          family: null,
          status: null,
          statusSkill: null,
          statusBodyEnhancement: null,
        },
        abilities: {
          technique: 0,
          body: 0,
          heart: 0,
        },
        money: {
          starting: 0,
          remaining: 0,
        },
        inventory: {
          weapons: [],
          armor: [],
          shields: [],
          gear: [],
        },
        identity: {
          age: null,
          gender: null,
          faith: null,
          heightCm: null,
          weightKg: null,
          hairColor: null,
          eyeColor: null,
          skinTone: null,
        },
        appearanceImage: null,
      })),
      getPregamePlanning: vi.fn(async () => ({
        gameId: 'game-private',
        gameName: 'Private Delve',
        viewer: {
          isMember: true,
          isGameMaster: false,
        },
        activePrompt: null,
        recentClaims: [],
      })),
      postPregameObservationSession: vi.fn(async () => undefined),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/games/game-private/characters/char-1/edit?entry=digest&focus=resume']}>
        <Routes>
          <Route path="/games/:gameId/characters/:characterId/edit" element={<CharacterWizardPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Edit Character Draft' })).toBeTruthy();
    expect(screen.getByText('Resume this draft and keep the pregame loop moving')).toBeTruthy();
    expect(screen.getByText('Opened from Pregame Digest as the shortest path back into the current planning loop.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back To Inbox' }).getAttribute('href')).toBe('/inbox?mode=player');
  });
});
