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

test('keeps creator planning focus aligned when opened from lobby, chat, and characters on phone', async ({
  browser,
}, testInfo) => {
  test.slow();

  const gm = createSyntheticActor('gm-pregame-create-context', testInfo);
  const player = builtinPlayer;
  const token = Date.now().toString(36);
  const gameName = `Pregame Create Context ${testInfo.parallelIndex} ${token}`;
  const characterName = `Lyra ${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    const gameId = await createGame(gmPage, gameName);
    await invitePlayer(gmPage, gameName, 'player@example.com');
    await acceptInvite(playerPage, gameName);

    await openLobbyFromMyGames(gmPage, gameName);
    await gmPage.getByRole('button', { name: 'Post Prompt For Open Roles' }).click();
    await expect(
      gmPage.getByText(
        'We still need Frontline, Healer, Scout, and Arcane Support. Please share a draft or revise your current build if you can cover one of those roles.'
      )
    ).toBeVisible({ timeout: 15_000 });

    await playerPage.setViewportSize({ width: 390, height: 844 });
    await openLobbyFromMyGames(playerPage, gameName);
    await playerPage.getByRole('link', { name: 'Create For Frontline' }).click();

    await expect(playerPage.getByRole('heading', { name: /Character Wizard|Edit Character Draft/ })).toBeVisible();
    await expect(playerPage.getByRole('heading', { name: 'Planning Focus' })).toBeVisible();
    await expect(playerPage.getByText('Draft toward Frontline')).toBeVisible();
    await expect(playerPage.getByText('Opened from Lobby so the game need stays visible while you draft.')).toBeVisible();
    await expect(playerPage.getByRole('link', { name: 'Back To Lobby' })).toBeVisible();

    await autofillCharacterWizardDraft(playerPage, characterName);
    const checkpointPanel = playerPage.getByLabel('Share Current Checkpoint');
    await checkpointPanel.getByRole('button', { name: 'Share Update' }).click();
    await expect(checkpointPanel.getByRole('button', { name: 'Shared To Chat' })).toBeVisible({ timeout: 15_000 });

    await playerPage.getByRole('link', { name: 'Chat' }).click();
    await expect(playerPage.getByRole('heading', { name: 'Game Chat' })).toBeVisible();
    await expect(playerPage.getByText(`Sharing ${characterName} for party feedback.`)).toBeVisible();

    await playerPage.getByRole('link', { name: 'Answer In Creator' }).click();
    await expect(playerPage.getByRole('heading', { name: /Character Wizard|Edit Character Draft/ })).toBeVisible();
    await expect(playerPage.getByText('Answer the GM prompt: Party needs Frontline, Healer, Scout, and Arcane Support')).toBeVisible();
    await expect(playerPage.getByText('Opened from Chat so you can revise in response to the current conversation.')).toBeVisible();
    await expect(playerPage.getByRole('link', { name: 'Back To Chat' })).toBeVisible();

    await playerPage.getByRole('link', { name: 'Characters' }).click();
    await expect(playerPage.getByRole('heading', { name: 'Characters Workbench' })).toBeVisible();
    await expect(playerPage.getByRole('table', { name: 'Characters workbench mine' })).toBeVisible();
    await playerPage.getByRole('link', { name: 'Edit' }).click();

    await expect(playerPage.getByRole('heading', { name: /Character Wizard|Edit Character Draft/ })).toBeVisible();
    await expect(playerPage.getByText('Carry review feedback back into the draft')).toBeVisible();
    await expect(playerPage.getByText('Opened from Characters so inspection feedback can turn into a draft change quickly.')).toBeVisible();
    await expect(playerPage.getByRole('link', { name: 'Back To Characters' })).toBeVisible();
  } finally {
    await Promise.all([gmContext.close().catch(() => undefined), playerContext.close().catch(() => undefined)]);
  }
});
