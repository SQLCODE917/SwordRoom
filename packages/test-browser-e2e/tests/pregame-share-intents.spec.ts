import { expect, test } from '@playwright/test';
import {
  acceptInvite,
  autofillCharacterWizardDraft,
  builtinPlayer,
  createGame,
  createSyntheticActor,
  invitePlayer,
  openAuthenticatedPage,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('protects the phone-first pregame loop from lobby through digest re-entry', async ({ browser }, testInfo) => {
  test.slow();

  const gm = createSyntheticActor('gm-pregame-loop', testInfo);
  const player = builtinPlayer;
  const token = Date.now().toString(36);
  const gameName = `Pregame Loop ${testInfo.parallelIndex} ${token}`;
  const draftName = `Lyra ${token}`;
  const compareNote = 'Option A stays Fighter 1. Option B pivots to Priest 2 for party support.';
  const followUp = 'I can stay backline if someone else claims frontline.';

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    const gameId = await createGame(gmPage, gameName);
    await invitePlayer(gmPage, gameName, 'player@example.com');
    await acceptInvite(playerPage, gameName);

    await gmPage.goto(`/games/${encodeURIComponent(gameId)}`);
    await expect(gmPage.getByRole('heading', { name: 'Pregame Lobby' })).toBeVisible();
    await gmPage.getByRole('button', { name: 'Post Prompt For Open Roles' }).click();
    await expect(gmPage.getByText('Party needs Frontline, Healer, Scout, and Arcane Support')).toBeVisible({ timeout: 15_000 });

    await playerPage.setViewportSize({ width: 390, height: 844 });
    await playerPage.goto(`/games/${encodeURIComponent(gameId)}`);
    await expect(playerPage.getByRole('heading', { name: 'Pregame Lobby' })).toBeVisible();
    await expect(playerPage.getByText('Party needs Frontline, Healer, Scout, and Arcane Support')).toBeVisible();
    await playerPage.goto(`/games/${encodeURIComponent(gameId)}/character/new`);
    await autofillCharacterWizardDraft(playerPage, draftName);

    const sharePanel = playerPage.getByLabel('Share Current Checkpoint');
    await sharePanel.getByLabel('Compare directions').check();
    await sharePanel.getByLabel('Directions to compare').fill(compareNote);
    await sharePanel.getByRole('button', { name: 'Share Update' }).click();
    await expect(sharePanel.getByRole('button', { name: 'Shared To Chat' })).toBeVisible({ timeout: 15_000 });

    await playerPage.goto(`/games/${encodeURIComponent(gameId)}/chat`);
    await expect(playerPage.getByRole('heading', { name: 'Game Chat' })).toBeVisible();
    await expect(playerPage.getByText(`${draftName} is comparing two build directions.`)).toBeVisible();
    await expect(playerPage.getByText('Share: Compare directions')).toBeVisible();
    await expect(playerPage.getByText(compareNote)).toBeVisible();

    await playerPage.getByRole('button', { name: 'Preview' }).click();
    const previewDialog = playerPage.getByRole('dialog', { name: 'Character draft preview' });
    await expect(previewDialog.getByText('Share: Compare directions')).toBeVisible();
    await expect(previewDialog.getByText(compareNote)).toBeVisible();
    await previewDialog.getByRole('button', { name: 'Reply' }).click();
    await expect(playerPage.getByLabel('Message')).toHaveValue(`About ${draftName} v2: `);
    await playerPage.getByLabel('Message').fill(`About ${draftName} v2: ${followUp}`);
    await playerPage.getByRole('button', { name: 'Send' }).click();
    await expect(playerPage.getByText(`About ${draftName} v2: ${followUp}`)).toBeVisible();

    await gmPage.goto(`/games/${encodeURIComponent(gameId)}/chat`);
    await expect(gmPage.getByRole('heading', { name: 'Game Chat' })).toBeVisible();
    await expect(gmPage.getByText(`${draftName} is comparing two build directions.`)).toBeVisible();
    await gmPage.getByRole('button', { name: 'Party fit' }).first().click();
    await expect(gmPage.getByText('Reactions: Party fit 1')).toBeVisible();

    await playerPage.goto(`/games/${encodeURIComponent(gameId)}/characters`);
    await expect(playerPage.getByRole('heading', { name: 'Characters Workbench' })).toBeVisible();
    await playerPage.getByRole('tab', { name: /Shared \(1\)/ }).click();
    const previewPanel = playerPage.getByLabel(`${draftName} Preview`);
    await expect(previewPanel.getByText('Compare directions')).toBeVisible();
    await expect(previewPanel.getByText(compareNote)).toBeVisible();
    await expect(previewPanel.getByText('1 follow-up message · 1 reaction')).toBeVisible();
    await expect(previewPanel.getByText('Reactions: Party fit 1')).toBeVisible();

    await playerPage.goto('/me/inbox');
    const digestTable = playerPage.getByRole('table', { name: 'Pregame Digest Items' });
    const digestRow = digestTable.getByRole('row').filter({ hasText: gameName }).first();
    await expect(digestRow).toBeVisible({ timeout: 15_000 });
    await digestRow.getByRole('link', { name: 'Edit Draft' }).click();
    await expect(playerPage.getByRole('heading', { name: /Character Wizard|Edit Character Draft/ })).toBeVisible();
    await expect(playerPage.getByLabel('Share Current Checkpoint')).toBeVisible();
  } finally {
    await Promise.all([gmContext.close().catch(() => undefined), playerContext.close().catch(() => undefined)]);
  }
});
