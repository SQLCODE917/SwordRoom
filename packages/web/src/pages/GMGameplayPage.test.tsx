import { createRef } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameplayLoopGraph } from '@starter/shared';
import type { GameplayView } from '../api/ApiClient';
import { useGameChat } from '../hooks/useGameChat';
import { useGameplayView } from '../hooks/useGameplayView';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { GMGameplayPage } from './GMGameplayPage';

vi.mock('../hooks/useGameplayView', () => ({
  useGameplayView: vi.fn(),
}));

vi.mock('../hooks/useGameChat', () => ({
  useGameChat: vi.fn(),
}));

vi.mock('../hooks/useCommandStatus', () => ({
  createCommandId: () => 'cmd-1',
  useCommandWorkflow: vi.fn(),
}));

function createGameplayView(overrides?: Partial<GameplayView['session']>): GameplayView {
  return {
    gameId: 'game-1',
    gameName: 'Dungeon Delvers',
    view: 'GM',
    graph: {
      nodes: [...gameplayLoopGraph.nodes],
      edges: [...gameplayLoopGraph.edges],
    },
    participants: [
      {
        playerId: 'gm-1',
        displayName: 'GM',
        role: 'GM',
        characterId: null,
      },
    ],
    session: {
      sessionId: 'main',
      scenarioId: 'rpg_sample_tavern',
      graphVersion: gameplayLoopGraph.version,
      currentNodeId: 'SCENE_FRAME',
      status: 'ACTIVE',
      sceneTitle: 'Tavern At Sundown',
      sceneSummary: 'The Brando family is making trouble in the tavern.',
      focusPrompt: 'What do the heroes do next?',
      selectedProcedure: null,
      pendingIntentId: null,
      activeCheck: null,
      combatants: [],
      combat: null,
      updatedAt: '2026-04-10T00:00:00.000Z',
      version: 1,
      ...overrides,
    },
    publicEvents: [
      {
        eventId: 'evt-public-1',
        gameId: 'game-1',
        audience: 'PUBLIC',
        eventKind: 'INTENT_SUBMITTED',
        nodeId: 'PLAYER_INTENT',
        actorId: 'player-1',
        title: 'Asha declares an intent',
        body: 'Step between the thugs and the poster girl.',
        detail: {
          characterId: 'char-1',
        },
        createdAt: '2026-04-10T00:00:00.000Z',
      },
    ],
    gmOnlyEvents: [
      {
        eventId: 'evt-gm-1',
        gameId: 'game-1',
        audience: 'GM_ONLY',
        eventKind: 'PROCEDURE_SELECTED',
        nodeId: 'STANDARD_CHECK',
        actorId: 'gm-1',
        title: 'GM procedure details',
        body: 'baseline=4, modifiers=0, target=10',
        detail: {},
        createdAt: '2026-04-10T00:01:00.000Z',
      },
    ],
  };
}

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
    matches,
    media: '(min-width: 1024px)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/gm/:gameId/play" element={<><GMGameplayPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GMGameplayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia(false);
    vi.mocked(useGameChat).mockReturnValue({
      chat: {
        gameName: 'Dungeon Delvers',
        participants: [],
        messages: [],
      },
      initialLoading: false,
      error: null,
      draftBody: '',
      setDraftBody: vi.fn(),
      membersOpen: false,
      setMembersOpen: vi.fn(),
      transcriptRef: createRef<HTMLDivElement>(),
      isSending: false,
      commandStatus: {
        state: 'Idle',
        commandId: null,
        message: 'No command submitted yet.',
        errorCode: null,
        errorMessage: null,
      },
      sendMessage: vi.fn(async () => undefined),
    });
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
      submitEnvelopeAndAwait: vi.fn(async () => ({
        commandId: 'cmd-1',
        status: 'PROCESSED' as const,
        errorCode: null,
        errorMessage: null,
      })),
    });
  });

  it('defaults to control mode and step panel, and normalizes invalid params', async () => {
    vi.mocked(useGameplayView).mockReturnValue({
      gameplay: createGameplayView(),
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });

    renderPage('/gm/game-1/play?mode=bogus&panel=nope&utility=ghost&transcript=wrong');

    expect(await screen.findByRole('heading', { name: 'GM Play' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Current Step' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() =>
      expect(screen.getByTestId('location-search').textContent).toBe('?mode=control&panel=step&transcript=public')
    );
  });

  it('preserves control panel state when switching to chat and back', async () => {
    vi.mocked(useGameplayView).mockReturnValue({
      gameplay: createGameplayView(),
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });

    renderPage('/gm/game-1/play?mode=control&panel=graph&transcript=public');

    expect(await screen.findByRole('heading', { name: 'GM Play' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Whole Graph' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(await screen.findByRole('button', { name: 'Back to Control Center' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Control Center' }));
    expect(await screen.findByRole('heading', { name: 'Whole Graph' })).toBeTruthy();
    expect(screen.getByTestId('location-search').textContent).toContain('panel=graph');
  });

  it('renders only standard-check controls for standard check state', async () => {
    vi.mocked(useGameplayView).mockReturnValue({
      gameplay: createGameplayView({
        currentNodeId: 'STANDARD_CHECK',
        selectedProcedure: 'STANDARD_CHECK',
        activeCheck: {
          checkId: 'check-1',
          procedure: 'STANDARD_CHECK',
          actionLabel: 'Calm the room',
          baselineScore: 4,
          modifiers: 0,
          targetScore: 10,
          difficulty: null,
          playerRollTotal: null,
          gmRollTotal: null,
          automaticResult: null,
          outcome: 'PENDING',
          publicNarration: null,
          gmNarration: null,
        },
      }),
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });

    renderPage('/gm/game-1/play');

    expect(await screen.findByRole('heading', { name: 'Resolve Check' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Player roll' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'GM roll' })).toBeNull();
  });

  it('renders hidden-check controls for difficulty check state', async () => {
    vi.mocked(useGameplayView).mockReturnValue({
      gameplay: createGameplayView({
        currentNodeId: 'DIFFICULTY_CHECK',
        selectedProcedure: 'DIFFICULTY_CHECK',
        activeCheck: {
          checkId: 'check-2',
          procedure: 'DIFFICULTY_CHECK',
          actionLabel: 'Read the Brando family',
          baselineScore: 3,
          modifiers: 0,
          targetScore: null,
          difficulty: 5,
          playerRollTotal: null,
          gmRollTotal: null,
          automaticResult: null,
          outcome: 'PENDING',
          publicNarration: null,
          gmNarration: null,
        },
      }),
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });

    renderPage('/gm/game-1/play');

    expect(await screen.findByRole('heading', { name: 'Resolve Check' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'GM roll' })).toBeTruthy();
  });

  it('expands the rules info widget', async () => {
    vi.mocked(useGameplayView).mockReturnValue({
      gameplay: createGameplayView({
        currentNodeId: 'STANDARD_CHECK',
        selectedProcedure: 'STANDARD_CHECK',
      }),
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });

    renderPage('/gm/game-1/play');

    fireEvent.click(await screen.findByRole('button', { name: 'Show Info' }));
    expect(screen.getByText('Double sixes auto-succeed and double ones auto-fail.')).toBeTruthy();
  });

  it('opens transcript utility and switches transcript audience', async () => {
    vi.mocked(useGameplayView).mockReturnValue({
      gameplay: createGameplayView(),
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });

    renderPage('/gm/game-1/play');

    fireEvent.click(await screen.findByRole('button', { name: 'Open Transcript' }));
    const dialog = await screen.findByRole('dialog', { name: 'GM utility panel' });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Step between the thugs and the poster girl.')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('tab', { name: 'GM' }));
    expect(await within(dialog).findByText('baseline=4, modifiers=0, target=10')).toBeTruthy();
  });

  it('shows utilities as a sheet on mobile and a dock on desktop', async () => {
    vi.mocked(useGameplayView).mockReturnValue({
      gameplay: createGameplayView(),
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });

    const mobile = renderPage('/gm/game-1/play');
    fireEvent.click(await screen.findByRole('button', { name: 'Open Status' }));
    expect(await screen.findByRole('dialog', { name: 'GM utility panel' })).toBeTruthy();
    mobile.unmount();

    mockMatchMedia(true);
    renderPage('/gm/game-1/play');
    fireEvent.click(await screen.findByRole('button', { name: 'Open Status' }));
    expect(await screen.findByLabelText('GM utility dock')).toBeTruthy();
  });
});
