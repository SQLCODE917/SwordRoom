import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  applyToJoinWithNewCharacter,
  approvePendingCharacter,
  createGame,
  createSyntheticActor,
  openAuthenticatedPage,
  openLobbyFromMyGames,
  postCommandAsCurrentActor,
  setGameVisibility,
  waitForCommandStatus,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('routes pregame digest entries back into lobby and chat planning surfaces', async ({ browser }, testInfo) => {
  const gm = createSyntheticActor('gm-pregame-digest', testInfo);
  const player = createSyntheticActor('player-pregame-digest', testInfo);
  const token = Date.now().toString(36);
  const gameWithPromptName = `Pregame Prompt ${testInfo.parallelIndex} ${token}`;
  const gameWithClaimName = `Pregame Claim ${testInfo.parallelIndex} ${token}`;
  const playerOneName = `Borin ${token}`;
  const playerTwoName = `Asha ${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    const promptGameId = await createGame(gmPage, gameWithPromptName);
    await setGameVisibility(gmPage, gameWithPromptName, 'PUBLIC');
    await applyToJoinWithNewCharacter(playerPage, gameWithPromptName, playerOneName);
    await approvePendingCharacter(gmPage, promptGameId, player.actorId);

    const claimGameId = await createGame(gmPage, gameWithClaimName);
    await setGameVisibility(gmPage, gameWithClaimName, 'PUBLIC');
    await applyToJoinWithNewCharacter(playerPage, gameWithClaimName, playerTwoName);
    await approvePendingCharacter(gmPage, claimGameId, player.actorId);

    await openLobbyFromMyGames(gmPage, gameWithPromptName);
    await gmPage.getByRole('button', { name: 'Post Prompt For Open Roles' }).click();
    await expect(gmPage.getByText('Party needs Frontline, Healer, Scout, and Arcane Support')).toBeVisible({ timeout: 15_000 });

    await playerPage.goto('/');
    const claimGameRow = playerPage.getByRole('table', { name: 'My Games' }).getByRole('row').filter({ hasText: gameWithClaimName }).first();
    const claimCharacterSheetHref = await claimGameRow.getByRole('link', { name: 'Sheet' }).getAttribute('href');
    if (!claimCharacterSheetHref) {
      throw new Error(`missing character sheet link for "${gameWithClaimName}"`);
    }
    const claimCharacterId = decodeURIComponent(claimCharacterSheetHref.split('/').at(-1) ?? '');

    const claimCommandId = randomUUID();
    const claimPosted = await postCommandAsCurrentActor(gmPage, {
      commandId: claimCommandId,
      gameId: claimGameId,
      type: 'SendGameChatMessage',
      schemaVersion: 1,
      createdAt: '2026-03-01T09:16:00.000Z',
      payload: {
        body: `${playerTwoName} is claiming Frontline for the party.`,
        artifact: {
          kind: 'PARTY_ROLE_CLAIM',
          claimId: `${claimCharacterId}:frontline`,
          characterId: claimCharacterId,
          snapshotVersion: 2,
          characterName: playerTwoName,
          roles: ['FRONTLINE'],
          note: 'Current plan is to cover Frontline.',
        },
      },
    });
    const claimStatus = await waitForCommandStatus(gmPage, claimPosted.commandId);
    expect(claimStatus.status).toBe('PROCESSED');

    await playerPage.goto('/me/inbox');
    const digestTable = playerPage.getByRole('table', { name: 'Pregame Digest Items' });

    const lobbyRow = digestTable.getByRole('row').filter({ hasText: gameWithPromptName }).first();
    await expect(lobbyRow).toBeVisible({ timeout: 15_000 });
    await expect(lobbyRow.getByText('Party needs Frontline, Healer, Scout, and Arcane Support')).toBeVisible();
    await lobbyRow.getByRole('link', { name: 'Open Lobby' }).click();
    await expect(playerPage.getByRole('heading', { name: 'Pregame Lobby' })).toBeVisible();
    await expect(
      playerPage.getByText(
        'We still need Frontline, Healer, Scout, and Arcane Support. Please share a draft or revise your current build if you can cover one of those roles.'
      )
    ).toBeVisible();

    await playerPage.goto('/me/inbox');
    const chatRow = digestTable.getByRole('row').filter({ hasText: gameWithClaimName }).first();
    await expect(chatRow).toBeVisible({ timeout: 15_000 });
    await expect(chatRow.getByText(`${playerTwoName} updated party roles`)).toBeVisible();
    await chatRow.getByRole('link', { name: 'Open Chat' }).click();
    await expect(playerPage.getByRole('heading', { name: 'Game Chat' })).toBeVisible();
    await expect(playerPage.getByText(`${playerTwoName} claims Frontline`)).toBeVisible();
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
  }
});
