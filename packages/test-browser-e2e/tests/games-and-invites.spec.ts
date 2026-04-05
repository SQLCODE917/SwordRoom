import { expect, test } from '@playwright/test';
import {
  builtinPlayer,
  createGame,
  createSyntheticActor,
  gmGamesRow,
  invitePlayer,
  myGamesRow,
  openAuthenticatedPage,
  playerInboxRow,
  publicGamesRow,
  acceptInvite,
  setGameVisibility,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('keeps private games out of public listings and only enables chat after membership', async ({ browser }, testInfo) => {
  const gm = createSyntheticActor('invite-gm', testInfo);
  const inviteGameName = `Invite Only ${testInfo.parallelIndex} ${Date.now().toString(36)}`;
  const publicGameName = `Public Lobby ${testInfo.parallelIndex} ${Date.now().toString(36)}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, builtinPlayer);

  try {
    const primaryNav = gmPage.getByRole('navigation', { name: 'Primary' });
    await expect(primaryNav.getByText('GM Inbox')).toHaveAttribute('aria-disabled', 'true');

    const inviteGameId = await createGame(gmPage, inviteGameName);
    await expect(primaryNav.getByRole('link', { name: 'GM Inbox' })).toHaveAttribute(
      'href',
      `/gm/${encodeURIComponent(inviteGameId)}/inbox`
    );

    await createGame(gmPage, publicGameName);
    await setGameVisibility(gmPage, publicGameName, 'PUBLIC');

    await playerPage.goto('/');
    await expect(publicGamesRow(playerPage, inviteGameName)).toHaveCount(0);
    await expect(publicGamesRow(playerPage, publicGameName)).toBeVisible();
    await expect(publicGamesRow(playerPage, publicGameName).getByRole('link', { name: 'Chat' })).toHaveCount(0);
    await expect(myGamesRow(playerPage, publicGameName)).toHaveCount(0);

    await invitePlayer(gmPage, inviteGameName, 'player@example.com');
    await playerPage.goto('/me/inbox');
    await expect(playerInboxRow(playerPage, inviteGameName)).toBeVisible({ timeout: 15_000 });
    await acceptInvite(playerPage, inviteGameName);

    await playerPage.goto('/');
    await expect(myGamesRow(playerPage, inviteGameName)).toBeVisible();
    await expect(myGamesRow(playerPage, inviteGameName).getByRole('link', { name: 'Chat' })).toBeVisible();
    await expect(myGamesRow(playerPage, publicGameName)).toHaveCount(0);
    await expect(publicGamesRow(playerPage, publicGameName).getByRole('link', { name: 'Chat' })).toHaveCount(0);

    await expect(gmGamesRow(gmPage, inviteGameName)).toBeVisible();
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
  }
});
