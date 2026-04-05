import { expect, test } from '@playwright/test';
import {
  applyToJoinWithNewCharacter,
  applyToJoinWithSavedCharacter,
  approvePendingCharacter,
  createGame,
  createLibraryCharacter,
  createSyntheticActor,
  myGamesRow,
  openAuthenticatedPage,
  publicGamesRow,
  setGameVisibility,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('allows a player to apply to a public game with a new character and enter chat after approval', async ({ browser }, testInfo) => {
  const gm = createSyntheticActor('gm-new-char', testInfo);
  const player = createSyntheticActor('player-new-char', testInfo);
  const gameName = `Public Apply ${testInfo.parallelIndex} ${Date.now().toString(36)}`;
  const characterName = `Rook ${Date.now().toString(36)}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await playerPage.goto('/');
    await expect(publicGamesRow(playerPage, gameName)).toBeVisible();
    await expect(publicGamesRow(playerPage, gameName).getByRole('link', { name: 'Chat' })).toHaveCount(0);

    await applyToJoinWithNewCharacter(playerPage, gameName, characterName);
    await approvePendingCharacter(gmPage, gameId, player.actorId);

    await playerPage.goto('/');
    await expect(myGamesRow(playerPage, gameName)).toBeVisible();
    await expect(myGamesRow(playerPage, gameName).getByRole('link', { name: 'Chat' })).toBeVisible();
    await expect(myGamesRow(playerPage, gameName).getByRole('link', { name: 'Sheet' })).toBeVisible();
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
  }
});

test('allows a player to apply to a public game with a saved character', async ({ browser }, testInfo) => {
  const gm = createSyntheticActor('gm-saved-char', testInfo);
  const player = createSyntheticActor('player-saved-char', testInfo);
  const gameName = `Saved Apply ${testInfo.parallelIndex} ${Date.now().toString(36)}`;
  const characterName = `Lyra ${Date.now().toString(36)}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await createLibraryCharacter(playerPage, characterName);
    await playerPage.goto('/');
    await expect(publicGamesRow(playerPage, gameName)).toBeVisible();

    await applyToJoinWithSavedCharacter(playerPage, gameName, characterName);
    await approvePendingCharacter(gmPage, gameId, player.actorId);

    await playerPage.goto('/');
    await expect(myGamesRow(playerPage, gameName)).toBeVisible();
    await expect(myGamesRow(playerPage, gameName).getByRole('link', { name: 'Chat' })).toBeVisible();
    await expect(myGamesRow(playerPage, gameName).getByRole('link', { name: 'Sheet' })).toBeVisible();
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
  }
});

test('disables duplicate join actions, then allows re-applying after the player leaves the game', async ({ browser }, testInfo) => {
  const gm = createSyntheticActor('gm-reapply', testInfo);
  const player = createSyntheticActor('player-reapply', testInfo);
  const gameName = `Reapply ${testInfo.parallelIndex} ${Date.now().toString(36)}`;
  const characterName = `Mira ${Date.now().toString(36)}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await applyToJoinWithNewCharacter(playerPage, gameName, characterName);
    await approvePendingCharacter(gmPage, gameId, player.actorId);

    await playerPage.goto('/');
    const myGameRow = myGamesRow(playerPage, gameName);
    const publicGameRow = publicGamesRow(playerPage, gameName);
    const disabledNewCharacter = myGameRow.getByRole('link', { name: 'New Character' });
    const disabledApplyToJoin = publicGameRow.getByRole('link', { name: 'Apply to Join' });

    await expect(disabledNewCharacter).toHaveAttribute('aria-disabled', 'true');
    await expect(disabledNewCharacter).toHaveAttribute('title', 'You already have a character in this game.');
    await expect(disabledApplyToJoin).toHaveAttribute('aria-disabled', 'true');
    await expect(disabledApplyToJoin).toHaveAttribute('title', 'You already have a character in this game.');

    await myGameRow.getByRole('link', { name: 'Sheet' }).click();
    await expect(playerPage.getByRole('button', { name: 'Leave Game' })).toBeVisible();
    await playerPage.getByRole('button', { name: 'Leave Game' }).click();

    await expect(playerPage).toHaveURL(/\/$/);
    await expect(myGamesRow(playerPage, gameName)).toHaveCount(0);

    const restoredApplyToJoin = publicGamesRow(playerPage, gameName).getByRole('link', { name: 'Apply to Join' });
    await expect(restoredApplyToJoin).toHaveAttribute('href', `/games/${encodeURIComponent(gameId)}/character/new`);
    await expect(restoredApplyToJoin).not.toHaveAttribute('aria-disabled', 'true');
    await expect(restoredApplyToJoin).not.toHaveAttribute('title', /.+/);

    await restoredApplyToJoin.click();
    await expect(playerPage.getByRole('heading', { name: 'Character Wizard' })).toBeVisible();
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
  }
});
