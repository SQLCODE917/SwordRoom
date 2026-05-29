import type {
  CharacterItem,
  GameChatMessage,
  GameChatParticipant,
} from "../../api/ApiClient";
import { appendCharacterWizardEntryContext } from "../character-wizard";
import type { PregameLobbyState } from "./usePregameLobby";

export type PregameLobbyViewModel =
  | {
      status: "loading";
      title: string;
      subtitle: string;
      noticeTone: "info";
      notice: string;
      actions: LobbyAction[];
    }
  | {
      status: "error";
      title: string;
      subtitle: string;
      noticeTone: "error";
      notice: string;
      actions: LobbyAction[];
    }
  | {
      status: "live";
      title: string;
      subtitle: string;
      noticeTone: "info";
      notice: string;
      actions: LobbyAction[];
    }
  | {
      status: "ready";
      title: string;
      subtitle: string;
      noticeTone: "info";
      notice: string;
      actions: LobbyAction[];
      workflow: LobbyWorkflow;
      statusMetrics: LobbyStatusMetric[];
      statusHint: string;
      primaryAction: LobbyPrimaryAction;
      prompt: LobbyPromptViewModel;
      rosterRows: LobbyRosterRow[];
      recentActivityEntries: LobbyActivityEntry[];
    };

export interface LobbyAction {
  label: string;
  to: string;
  disabled?: boolean;
  disabledReason?: string | null;
}

export interface LobbyStatusMetric {
  label: string;
  value: string;
  tone: "neutral" | "attention" | "ready";
}

export interface LobbyPromptViewModel {
  text: string;
}

export interface LobbyRosterRow {
  key: string;
  displayName: string;
  roleLabel: string;
  characterLabel: string;
  characterTo: string | null;
}

export interface LobbyActivityEntry {
  key: string;
  timeLabel: string;
  actorLabel: string;
  message: string;
  kind: "message" | "prompt" | "draft" | "reaction" | "claim";
}

export interface LobbyWorkflow {
  createTo: string;
  sheetTo: string | null;
}

export type LobbyPrimaryAction =
  | {
      kind: "route";
      label: string;
      to: string;
      detail: string;
    }
  | {
      kind: "command";
      label: string;
      detail: string;
    };

export function createPregameLobbyViewModel(
  state: PregameLobbyState,
): PregameLobbyViewModel {
  if (state.status === "loading") {
    return {
      status: "loading",
      title: "Pregame Lobby",
      subtitle: `Game ${state.gameId}`,
      noticeTone: "info",
      notice: "Loading pregame planning context...",
      actions: [{ label: "Home", to: "/" }],
    };
  }

  if (
    state.status === "error" ||
    state.status === "forbidden" ||
    state.status === "missing"
  ) {
    return {
      status: "error",
      title: "Pregame Lobby",
      subtitle: `Game ${state.gameId}`,
      noticeTone: "error",
      notice:
        state.status === "forbidden"
          ? "You do not have access to this game."
          : state.status === "missing"
            ? "This game was not found."
            : state.message,
      actions: [{ label: "Home", to: "/" }],
    };
  }

  if (state.status === "live") {
    return {
      status: "live",
      title: "Pregame Lobby",
      subtitle: `${state.game.name} (${state.game.gameId})`,
      noticeTone: "info",
      notice: state.actorContext.isGameMaster
        ? "Gameplay is live. Use GM Play to run the scene, or open Play to view the player-facing scene and chat."
        : "Gameplay is live. Open Play to enter the current scene, or use Chat to coordinate between turns.",
      actions: [
        {
          label: "Play",
          to: `/games/${encodeURIComponent(state.game.gameId)}/play`,
        },
        {
          label: "Chat",
          to: `/games/${encodeURIComponent(state.game.gameId)}/chat`,
        },
        ...(state.actorContext.isGameMaster
          ? [
              {
                label: "GM Play",
                to: `/gm/games/${encodeURIComponent(state.game.gameId)}?mode=gm-play`,
              },
            ]
          : []),
      ],
    };
  }

  const ownCharacter =
    state.myCharacters.find((item) => item.gameId === state.game.gameId) ??
    null;
  const ownParticipant =
    state.chat.participants.find(
      (participant) => participant.playerId === state.actorContext.actorId,
    ) ?? null;
  const canEditOwnCharacter = ownCharacter
    ? ownCharacter.status !== "PENDING" && ownCharacter.status !== "APPROVED"
    : false;

  const status = buildLobbyStatus(state, ownCharacter);
  const primaryAction = buildPrimaryAction(
    state,
    ownCharacter,
    canEditOwnCharacter,
  );

  return {
    status: "ready",
    title: "Pregame Lobby",
    subtitle: `${state.game.name} (${state.game.gameId})`,
    noticeTone: "info",
    notice: ownParticipant
      ? `Signed in as ${ownParticipant.displayName}. No session date is scheduled yet.`
      : "No session date is scheduled yet.",
    actions: buildActions({
      gameId: state.game.gameId,
      ownCharacter,
      canEditOwnCharacter,
      isGameMaster: state.actorContext.isGameMaster,
    }),
    workflow: {
      createTo:
        ownCharacter && canEditOwnCharacter
          ? appendCharacterWizardEntryContext(
              `/games/${encodeURIComponent(state.game.gameId)}/characters/${encodeURIComponent(ownCharacter.characterId)}/edit`,
              {
                entrySource: "lobby",
                focus: state.planning.activePrompt ? "prompt" : "revise",
              },
            )
          : appendCharacterWizardEntryContext(
              `/games/${encodeURIComponent(state.game.gameId)}/character/new`,
              {
                entrySource: "lobby",
                focus: "role",
              },
            ),
      sheetTo: ownCharacter
        ? `/games/${encodeURIComponent(state.game.gameId)}/characters/${encodeURIComponent(ownCharacter.characterId)}`
        : null,
    },
    statusMetrics: status.metrics,
    statusHint: status.hint,
    primaryAction,
    prompt: buildPrompt(state),
    rosterRows: state.chat.participants.map((participant) =>
      buildRosterRow(state.game.gameId, participant, ownCharacter),
    ),
    recentActivityEntries: state.chat.messages
      .slice(-5)
      .reverse()
      .map(buildActivityEntry),
  };
}

function buildActions(input: {
  gameId: string;
  ownCharacter: CharacterItem | null;
  canEditOwnCharacter: boolean;
  isGameMaster: boolean;
}): LobbyAction[] {
  const actions: LobbyAction[] = [];

  if (input.ownCharacter) {
    if (input.canEditOwnCharacter) {
      actions.push({
        label: "Continue Character",
        to: appendCharacterWizardEntryContext(
          `/games/${encodeURIComponent(input.gameId)}/characters/${encodeURIComponent(input.ownCharacter.characterId)}/edit`,
          { entrySource: "lobby", focus: "revise" },
        ),
      });
    }
    actions.push({
      label: "Character Sheet",
      to: `/games/${encodeURIComponent(input.gameId)}/characters/${encodeURIComponent(input.ownCharacter.characterId)}`,
    });
  } else {
    actions.push({
      label: "+ Create Character",
      to: appendCharacterWizardEntryContext(
        `/games/${encodeURIComponent(input.gameId)}/character/new`,
        {
          entrySource: "lobby",
          focus: "role",
        },
      ),
    });
  }

  actions.push({
    label: "Chat",
    to: `/games/${encodeURIComponent(input.gameId)}/chat`,
  });
  actions.push({
    label: "Inbox",
    to: input.isGameMaster
      ? `/inbox?mode=gm&gameId=${encodeURIComponent(input.gameId)}`
      : "/inbox?mode=player",
  });

  return actions;
}

function buildPrimaryAction(
  state: Extract<PregameLobbyState, { status: "ready" }>,
  ownCharacter: CharacterItem | null,
  canEditOwnCharacter: boolean,
): LobbyPrimaryAction {
  const gameId = state.game.gameId;
  const latestActivity =
    state.chat.messages[state.chat.messages.length - 1] ?? null;
  const hasPlayerActivity = state.chat.messages.some(
    (message) => message.senderRole === "PLAYER",
  );

  if (state.actorContext.isGameMaster) {
    if (!state.planning.activePrompt) {
      return {
        kind: "command",
        label: "Set Planning Prompt",
        detail: "Guide the party by posting a planning prompt.",
      };
    }
    if (latestActivity && hasPlayerActivity) {
      return {
        kind: "route",
        label: "Respond In Chat",
        to: `/games/${encodeURIComponent(gameId)}/chat`,
        detail:
          "Use the latest shared character draft or party conversation to steer the group.",
      };
    }
    return {
      kind: "route",
      label: "Open Chat",
      to: `/games/${encodeURIComponent(gameId)}/chat`,
      detail:
        "Engage your players - their character sheets are their wish lists.",
    };
  }

  if (ownCharacter && canEditOwnCharacter) {
    return {
      kind: "route",
      label: state.planning.activePrompt
        ? "Answer Prompt In Create"
        : "Revise Draft",
      to: appendCharacterWizardEntryContext(
        `/games/${encodeURIComponent(gameId)}/characters/${encodeURIComponent(ownCharacter.characterId)}/edit`,
        {
          entrySource: "lobby",
          focus: state.planning.activePrompt ? "prompt" : "revise",
        },
      ),
      detail: state.planning.activePrompt
        ? "Open your draft and respond directly to the active GM prompt."
        : "Continue iterating on your draft and share the next checkpoint with the table.",
    };
  }

  if (!ownCharacter) {
    return {
      kind: "route",
      label: "+ Create Character",
      to: appendCharacterWizardEntryContext(
        `/games/${encodeURIComponent(gameId)}/character/new`,
        {
          entrySource: "lobby",
          focus: "role",
        },
      ),
      detail: "Start a game-scoped character draft for this table.",
    };
  }

  return {
    kind: "route",
    label: "Open Chat",
    to: `/games/${encodeURIComponent(gameId)}/chat`,
    detail:
      "Review the latest planning conversation before choosing your next draft move.",
  };
}

function buildLobbyStatus(
  state: Extract<PregameLobbyState, { status: "ready" }>,
  ownCharacter: CharacterItem | null,
): { metrics: LobbyStatusMetric[]; hint: string } {
  const latestActivity =
    state.chat.messages[state.chat.messages.length - 1] ?? null;
  const playerCount = state.chat.participants.filter(
    (participant) => participant.role === "PLAYER",
  ).length;
  const playersWithoutCharacterCount = state.chat.participants.filter(
    (participant) =>
      participant.role === "PLAYER" && participant.characterId === null,
  ).length;
  const readyCharacterCount = Math.max(
    playerCount - playersWithoutCharacterCount,
    0,
  );
  const hasActivePrompt = Boolean(state.planning.activePrompt);

  const metrics: LobbyStatusMetric[] = [
    {
      label: "Players",
      value: playerCount === 1 ? "1 joined" : `${playerCount} joined`,
      tone: playerCount === 0 ? "attention" : "neutral",
    },
    {
      label: "Characters",
      value:
        playerCount === 0
          ? "0 ready"
          : `${readyCharacterCount}/${playerCount} ready`,
      tone:
        playerCount > 0 && playersWithoutCharacterCount === 0
          ? "ready"
          : "attention",
    },
    {
      label: "Prompt",
      value: state.planning.activePrompt
        ? formatTime(state.planning.activePrompt.createdAt)
        : "No prompt",
      tone: hasActivePrompt ? "ready" : "attention",
    },
    {
      label: "Latest",
      value: latestActivity
        ? `${latestActivity.senderDisplayName}, ${formatTime(latestActivity.createdAt)}`
        : "No activity",
      tone: latestActivity ? "neutral" : "attention",
    },
  ];

  let hint: string;
  if (state.actorContext.isGameMaster) {
    if (playerCount === 0) {
      hint = hasActivePrompt
        ? "No players have joined yet. But there is a prompt."
        : "No players have joined yet. Set a prompt so the first reply has direction.";
    } else if (playersWithoutCharacterCount === 0) {
      hint =
        "Every listed player has a character attached. Use Chat to align on final party fit.";
    } else if (playersWithoutCharacterCount === 1) {
      hint =
        "One player still needs a character before the party is fully represented.";
    } else {
      hint = `${playersWithoutCharacterCount} players still need characters before the party is fully represented.`;
    }
  } else if (playersWithoutCharacterCount === 1) {
    hint =
      "One player still needs a character before the party is fully represented.";
  } else if (playersWithoutCharacterCount > 1) {
    hint = `${playersWithoutCharacterCount} players still need characters before the party is fully represented.`;
  } else if (!ownCharacter) {
    hint =
      "Create a character or review Chat before choosing your draft direction.";
  } else if (ownCharacter.status === "PENDING") {
    hint =
      "Your character is pending GM review. Use Chat to coordinate while you wait.";
  } else if (ownCharacter.status === "APPROVED") {
    hint =
      "Your character is approved. Use Chat to align on party composition and opening plans.";
  } else {
    hint =
      "Your character is still editable. Share updates in Chat as you iterate.";
  }

  return { metrics, hint };
}

function buildPrompt(
  state: Extract<PregameLobbyState, { status: "ready" }>,
): LobbyPromptViewModel {
  if (state.planning.activePrompt) {
    return {
      text: state.planning.activePrompt.prompt,
    };
  }

  return {
    text: state.actorContext.isGameMaster
      ? "Set a prompt to give players one clear character-building direction."
      : "No GM planning prompt is active yet.",
  };
}

function buildRosterRow(
  gameId: string,
  participant: GameChatParticipant,
  ownCharacter: CharacterItem | null,
): LobbyRosterRow {
  const ownCharacterName =
    ownCharacter && ownCharacter.characterId === participant.characterId
      ? readCharacterName(ownCharacter)
      : null;
  const characterLabel =
    participant.characterId === null
      ? "No character yet"
      : (ownCharacterName ?? participant.characterId);

  return {
    key: participant.playerId,
    displayName: participant.displayName,
    roleLabel: participant.role === "GM" ? "GM" : "Player",
    characterLabel,
    characterTo:
      participant.characterId === null
        ? null
        : `/games/${encodeURIComponent(gameId)}/characters/${encodeURIComponent(participant.characterId)}`,
  };
}

function buildActivityEntry(message: GameChatMessage): LobbyActivityEntry {
  return {
    key: message.messageId,
    timeLabel: formatTime(message.createdAt),
    actorLabel: message.senderDisplayName,
    message: readActivityMessage(message),
    kind: readActivityKind(message),
  };
}

function readActivityKind(
  message: GameChatMessage,
): LobbyActivityEntry["kind"] {
  if (message.artifact?.kind === "GAME_PROMPT") {
    return "prompt";
  }
  if (message.artifact?.kind === "CHARACTER_DRAFT") {
    return "draft";
  }
  if (message.artifact?.kind === "PARTY_ROLE_CLAIM") {
    return "claim";
  }
  if (message.artifact?.kind === "CHARACTER_DRAFT_REACTION") {
    return "reaction";
  }
  return "message";
}

function readActivityMessage(message: GameChatMessage): string {
  if (message.artifact?.kind === "GAME_PROMPT") {
    return message.artifact.prompt;
  }
  if (message.artifact?.kind === "CHARACTER_DRAFT") {
    return (
      message.artifact.contextNote ??
      `Shared ${message.artifact.characterName}.`
    );
  }
  if (message.artifact?.kind === "PARTY_ROLE_CLAIM") {
    return (
      message.artifact.note ??
      `${message.artifact.characterName} claimed ${message.artifact.roles.join(", ")}.`
    );
  }
  if (message.artifact?.kind === "CHARACTER_DRAFT_REACTION") {
    return `${message.artifact.characterName}: ${message.artifact.reaction}`;
  }
  return message.body;
}

function readCharacterName(character: CharacterItem): string {
  const draft =
    typeof character.draft === "object" && character.draft !== null
      ? (character.draft as Record<string, unknown>)
      : null;
  const identity =
    draft && typeof draft.identity === "object" && draft.identity !== null
      ? (draft.identity as Record<string, unknown>)
      : null;
  const name = typeof identity?.name === "string" ? identity.name.trim() : "";
  return name || character.characterId;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
