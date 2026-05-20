import { expect, test } from '@playwright/test';
import {
  autofillCharacterWizardDraft,
  createGame,
  createSyntheticActor,
  openAuthenticatedPage,
  openLobbyFromMyGames,
  setGameVisibility,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('shares compare-direction creator updates through chat and the characters workbench on a phone viewport', async ({
  browser,
}, testInfo) => {
  const gm = createSyntheticActor('gm-pregame-compare', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Pregame Compare ${testInfo.parallelIndex} ${token}`;
  const draftName = `Lyra ${token}`;
  const compareNote = 'Option A stays Fighter 1. Option B pivots to Priest 2 for party support.';

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await gmPage.setViewportSize({ width: 390, height: 844 });
    await openLobbyFromMyGames(gmPage, gameName);
    await gmPage.getByRole('link', { name: 'Create' }).click();
    await autofillCharacterWizardDraft(gmPage, draftName);

    const sharePanel = gmPage.getByLabel('Share Current Checkpoint');
    await sharePanel.getByLabel('Compare directions').check();
    await sharePanel.getByLabel('Directions to compare').fill(compareNote);
    await sharePanel.getByRole('button', { name: 'Share Update' }).click();
    await expect(sharePanel.getByRole('button', { name: 'Shared To Chat' })).toBeVisible({ timeout: 15_000 });

    await gmPage.getByRole('link', { name: 'Chat' }).click();
    await expect(gmPage.getByRole('heading', { name: 'Game Chat' })).toBeVisible();
    await expect(gmPage.getByText(`${draftName} is comparing two build directions.`)).toBeVisible();
    await expect(gmPage.getByText('Share: Compare directions')).toBeVisible();
    await expect(gmPage.getByText(compareNote)).toBeVisible();
    await gmPage.getByRole('button', { name: 'Preview' }).click();
    const previewDialog = gmPage.getByRole('dialog', { name: 'Character draft preview' });
    await expect(previewDialog.getByText('Share: Compare directions')).toBeVisible();
    await expect(previewDialog.getByText(compareNote)).toBeVisible();
    await previewDialog.getByRole('button', { name: 'Close' }).click();

    await gmPage.getByRole('link', { name: 'Characters' }).click();
    await expect(gmPage.getByRole('heading', { name: 'Characters Workbench' })).toBeVisible();
    await gmPage.getByRole('tab', { name: /Shared \(1\)/ }).click();
    const previewPanel = gmPage.getByLabel(`${draftName} Preview`);
    await expect(previewPanel.getByText('Compare directions')).toBeVisible();
    await expect(previewPanel.getByText(compareNote)).toBeVisible();
  } finally {
    await gmContext.close();
  }
});
