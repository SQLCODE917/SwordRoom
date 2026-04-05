import { expect, test } from '@playwright/test';
import {
  applyToJoinWithNewCharacter,
  approvePendingCharacter,
  builtinPlayer,
  createGame,
  createSyntheticActor,
  deleteGame,
  invitePlayer,
  myGamesRow,
  openAuthenticatedPage,
  playerInboxRow,
  publicGamesRow,
  setGameVisibility,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('deleting a game cancels pending invites and rejects pending applicants with stock notifications', async ({
  browser,
}, testInfo) => {
  const gm = createSyntheticActor('gm-archive-pending', testInfo);
  const applicant = createSyntheticActor('player-archive-pending', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Archive Pending ${testInfo.parallelIndex} ${token}`;
  const applicantCharacterName = `Pending ${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: inviteeContext, page: inviteePage } = await openAuthenticatedPage(browser, builtinPlayer);
  const { context: applicantContext, page: applicantPage } = await openAuthenticatedPage(browser, applicant);

  try {
    await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await invitePlayer(gmPage, gameName, 'player@example.com');
    await applicantPage.goto('/');
    await expect(publicGamesRow(applicantPage, gameName)).toBeVisible();
    await applyToJoinWithNewCharacter(applicantPage, gameName, applicantCharacterName);

    await deleteGame(gmPage, gameName);

    await inviteePage.goto('/me/inbox');
    const cancelledInviteRow = playerInboxRow(inviteePage, gameName);
    await expect(cancelledInviteRow).toBeVisible({ timeout: 15_000 });
    await expect(cancelledInviteRow).toContainText(`Invitation to ${gameName} was cancelled because the game was deleted.`);
    await expect(cancelledInviteRow.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await expect(cancelledInviteRow.getByRole('button', { name: 'Reject' })).toHaveCount(0);

    await applicantPage.goto('/me/inbox');
    const rejectedApplicationRow = applicantPage
      .getByRole('table', { name: 'Player Inbox Items' })
      .getByRole('row')
      .filter({ hasText: 'Application closed because the game was deleted.' })
      .first();
    await expect(rejectedApplicationRow).toBeVisible({ timeout: 15_000 });

    await applicantPage.goto('/');
    await expect(publicGamesRow(applicantPage, gameName)).toHaveCount(0);
    await expect(myGamesRow(applicantPage, gameName)).toHaveCount(0);
  } finally {
    await Promise.all([gmContext.close(), inviteeContext.close(), applicantContext.close()]);
  }
});

test('deleting a game removes it from member views and notifies joined players', async ({ browser }, testInfo) => {
  const gm = createSyntheticActor('gm-archive-member', testInfo);
  const member = createSyntheticActor('player-archive-member', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Archive Member ${testInfo.parallelIndex} ${token}`;
  const memberCharacterName = `Keeper ${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: memberContext, page: memberPage } = await openAuthenticatedPage(browser, member);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await applyToJoinWithNewCharacter(memberPage, gameName, memberCharacterName);
    await approvePendingCharacter(gmPage, gameId, member.actorId);

    await memberPage.goto('/');
    await expect(myGamesRow(memberPage, gameName)).toBeVisible();
    await expect(myGamesRow(memberPage, gameName).getByRole('link', { name: 'Chat' })).toBeVisible();

    await deleteGame(gmPage, gameName);

    await memberPage.goto('/');
    await expect(myGamesRow(memberPage, gameName)).toHaveCount(0);
    await expect(publicGamesRow(memberPage, gameName)).toHaveCount(0);

    await memberPage.goto('/me/inbox');
    const deletedGameRow = playerInboxRow(memberPage, gameName);
    await expect(deletedGameRow).toBeVisible({ timeout: 15_000 });
    await expect(deletedGameRow).toContainText(`Game "${gameName}" was deleted by the GM.`);
  } finally {
    await Promise.all([gmContext.close(), memberContext.close()]);
  }
});
