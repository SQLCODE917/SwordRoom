import { expect, test } from '@playwright/test';
import {
  acceptInvite,
  autofillCharacterWizardDraft,
  builtinPlayer,
  createGame,
  createSyntheticActor,
  invitePlayer,
  openAuthenticatedPage,
  openLobbyFromMyGames,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('routes digest re-entry into the creator with digest-specific planning focus on phone', async ({ browser }, testInfo) => {
  test.slow();

  const gm = createSyntheticActor('gm-pregame-digest-create', testInfo);
  const player = builtinPlayer;
  const token = Date.now().toString(36);
  const gameName = `Pregame Digest Create ${testInfo.parallelIndex} ${token}`;
  const characterName = `Mira ${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    await createGame(gmPage, gameName);
    await invitePlayer(gmPage, gameName, 'player@example.com');
    await acceptInvite(playerPage, gameName);

    await openLobbyFromMyGames(gmPage, gameName);
    await gmPage.getByRole('button', { name: 'Post Prompt For Open Roles' }).click();
    await expect(
      gmPage.getByText('Prompt active: Party needs Frontline, Healer, Scout, and Arcane Support')
    ).toBeVisible({ timeout: 15_000 });

    await playerPage.setViewportSize({ width: 390, height: 844 });
    await openLobbyFromMyGames(playerPage, gameName);
    await playerPage.getByRole('link', { name: 'Create For Frontline' }).click();
    await expect(playerPage.getByRole('heading', { name: /Character Wizard|Edit Character Draft/ })).toBeVisible();
    await autofillCharacterWizardDraft(playerPage, characterName);
    const checkpointPanel = playerPage.getByLabel('Share Current Checkpoint');
    await checkpointPanel.getByRole('button', { name: 'Share Update' }).click();
    await expect(checkpointPanel.getByRole('button', { name: 'Shared To Chat' })).toBeVisible({ timeout: 15_000 });

    await playerPage.goto('/me/inbox');
    const digestTable = playerPage.getByRole('table', { name: 'Pregame Digest Items' });
    const row = digestTable.getByRole('row').filter({ hasText: gameName }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('link', { name: 'Edit Draft' }).click();

    await expect(playerPage.getByRole('heading', { name: /Character Wizard|Edit Character Draft/ })).toBeVisible();
    await expect(playerPage.getByRole('heading', { name: 'Planning Focus' })).toBeVisible();
    await expect(playerPage.getByText('Resume this draft and keep the pregame loop moving')).toBeVisible();
    await expect(
      playerPage.getByText('Opened from Pregame Digest as the shortest path back into the current planning loop.')
    ).toBeVisible();
    await expect(playerPage.getByRole('link', { name: 'Back To Inbox' })).toBeVisible();
  } finally {
    await Promise.all([gmContext.close().catch(() => undefined), playerContext.close().catch(() => undefined)]);
  }
});
