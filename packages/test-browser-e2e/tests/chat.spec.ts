import { expect, test, type Locator } from '@playwright/test';
import {
  applyToJoinWithNewCharacter,
  approvePendingCharacter,
  createGame,
  createSyntheticActor,
  openAuthenticatedPage,
  openChatFromMyGames,
  sendChatMessage,
  setGameVisibility,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('delivers chat messages between two players in the same game', async ({ browser }, testInfo) => {
  const gm = createSyntheticActor('gm-chat', testInfo);
  const playerOne = createSyntheticActor('player-one', testInfo);
  const playerTwo = createSyntheticActor('player-two', testInfo);
  const gameName = `Chat Room ${testInfo.parallelIndex} ${Date.now().toString(36)}`;
  const playerOneName = `Ari ${Date.now().toString(36)}`;
  const playerTwoName = `Bex ${Date.now().toString(36)}`;
  const messageBody = `hello-from-${Date.now().toString(36)}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerOneContext, page: playerOnePage } = await openAuthenticatedPage(browser, playerOne);
  const { context: playerTwoContext, page: playerTwoPage } = await openAuthenticatedPage(browser, playerTwo);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await applyToJoinWithNewCharacter(playerOnePage, gameName, playerOneName);
    await applyToJoinWithNewCharacter(playerTwoPage, gameName, playerTwoName);

    await approvePendingCharacter(gmPage, gameId, playerOne.actorId);
    await approvePendingCharacter(gmPage, gameId, playerTwo.actorId);

    await openChatFromMyGames(playerOnePage, gameName);
    await openChatFromMyGames(playerTwoPage, gameName);

    await expect(playerOnePage.getByText(`@${gm.actorId}`)).toBeVisible();
    await expect(playerOnePage.getByText(playerOneName, { exact: true })).toBeVisible();
    await expect(playerOnePage.getByText(playerTwoName, { exact: true })).toBeVisible();

    await sendChatMessage(playerOnePage, messageBody);

    await expect(playerTwoPage.getByText(messageBody, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(playerTwoPage.getByText(`<${playerOneName}>`, { exact: true })).toBeVisible({ timeout: 15_000 });
  } finally {
    await Promise.all([gmContext.close(), playerOneContext.close(), playerTwoContext.close()]);
  }
});

test('shows GM-first sorted members on desktop and in the mobile members sheet', async ({ browser }, testInfo) => {
  const gm = createSyntheticActor('gm-chat-members', testInfo);
  const playerOne = createSyntheticActor('player-borin', testInfo);
  const playerTwo = createSyntheticActor('player-alice', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Chat Members ${testInfo.parallelIndex} ${token}`;
  const playerOneName = `Borin ${token}`;
  const playerTwoName = `Alice ${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerOneContext, page: playerOnePage } = await openAuthenticatedPage(browser, playerOne);
  const { context: playerTwoContext, page: playerTwoPage } = await openAuthenticatedPage(browser, playerTwo);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await applyToJoinWithNewCharacter(playerOnePage, gameName, playerOneName);
    await applyToJoinWithNewCharacter(playerTwoPage, gameName, playerTwoName);

    await approvePendingCharacter(gmPage, gameId, playerOne.actorId);
    await approvePendingCharacter(gmPage, gameId, playerTwo.actorId);

    await openChatFromMyGames(playerOnePage, gameName);

    const expectedMembers = [`@${gm.actorId} GM`, `${playerTwoName} PLAYER`, `${playerOneName} PLAYER`];
    const desktopMembers = playerOnePage.locator('aside[aria-label="Game chat members"]');

    await expect(desktopMembers.getByRole('listitem')).toHaveCount(expectedMembers.length);
    await expect.poll(async () => readMemberList(desktopMembers)).toEqual(expectedMembers);

    await playerOnePage.setViewportSize({ width: 390, height: 844 });
    await playerOnePage.getByRole('button', { name: /^Members \(\d+\)$/ }).click();

    const mobileMembersDialog = playerOnePage.getByRole('dialog', { name: 'Game chat members' });
    await expect(mobileMembersDialog).toBeVisible();
    await expect.poll(async () => readMemberList(mobileMembersDialog)).toEqual(expectedMembers);

    await mobileMembersDialog.getByRole('button', { name: 'Close' }).click();
    await expect(mobileMembersDialog).toHaveCount(0);
  } finally {
    await Promise.all([gmContext.close(), playerOneContext.close(), playerTwoContext.close()]);
  }
});

async function readMemberList(container: Locator): Promise<string[]> {
  const items = await container.getByRole('listitem').all();
  const members: string[] = [];

  for (const item of items) {
    const name = (await item.locator('.c-chat__member-name').textContent())?.trim() ?? '';
    const role = (await item.locator('.c-chat__member-role').textContent())?.trim() ?? '';
    members.push(`${name} ${role}`.trim());
  }

  return members;
}
