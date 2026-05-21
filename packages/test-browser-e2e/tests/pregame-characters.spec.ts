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

test('keeps shared character review and chat handoff usable from the phone-sized Characters workbench', async ({
  browser,
}, testInfo) => {
  const gm = createSyntheticActor('gm-pregame-characters', testInfo);
  const player = createSyntheticActor('player-pregame-characters', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Pregame Characters ${testInfo.parallelIndex} ${token}`;
  const characterName = `Aline ${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');
    await applyToJoinWithNewCharacter(playerPage, gameName, characterName);
    await approvePendingCharacter(gmPage, gameId, player.actorId);

    await playerPage.setViewportSize({ width: 390, height: 844 });
    await playerPage.goto('/');
    const playerGameRow = playerPage.getByRole('table', { name: 'My Games' }).getByRole('row').filter({ hasText: gameName }).first();
    const sheetHref = await playerGameRow.getByRole('link', { name: 'Sheet' }).getAttribute('href');
    if (!sheetHref) {
      throw new Error(`missing character sheet link for "${gameName}"`);
    }
    const characterId = decodeURIComponent(sheetHref.split('/').at(-1) ?? '');

    const posted = await postCommandAsCurrentActor(playerPage, {
      commandId: randomUUID(),
      gameId,
      type: 'SendGameChatMessage',
      schemaVersion: 1,
      createdAt: '2026-03-01T09:16:00.000Z',
      payload: {
        body: `Sharing ${characterName} for party feedback.`,
        artifact: {
          kind: 'CHARACTER_DRAFT',
          characterId,
          snapshotVersion: 2,
          characterName,
          race: 'ELF',
          status: 'DRAFT',
          abilitySummary: ['INT 17', 'MP 18'],
          skillSummary: ['Priest 2'],
        },
      },
    });
    const shareStatus = await waitForCommandStatus(playerPage, posted.commandId);
    expect(shareStatus.status).toBe('PROCESSED');

    await openLobbyFromMyGames(playerPage, gameName);
    await playerPage.getByRole('link', { name: 'Characters' }).click();
    await expect(playerPage.getByRole('heading', { name: 'Characters Workbench' })).toBeVisible();

    await playerPage.getByRole('tab', { name: /Shared \(1\)/ }).click();
    const previewPanel = playerPage.getByLabel(`${characterName} Preview`);
    await expect(playerPage.getByText('No shared drafts are currently waiting on an explicit question response.')).toBeVisible();
    await expect(previewPanel.getByRole('heading', { name: `${characterName} Preview` })).toBeVisible();
    await expect(previewPanel.getByText('Snapshot v2 · DRAFT')).toBeVisible();
    await expect(previewPanel.getByText('INT 17 | MP 18')).toBeVisible();
    await expect(previewPanel.getByText('Skills: Priest 2')).toBeVisible();

    await previewPanel.getByRole('link', { name: 'Continue Discussion' }).click();
    await expect(playerPage.getByRole('heading', { name: 'Game Chat' })).toBeVisible();
    const activeDiscussion = playerPage.getByRole('region', { name: 'Active draft discussion' });
    await expect(activeDiscussion).toBeVisible();
    await expect(activeDiscussion.getByText(`${characterName} v2 is the current draft under discussion.`)).toBeVisible();
    await expect(playerPage.getByLabel('Message')).toHaveValue(`About ${characterName} v2: `);
    await activeDiscussion.getByRole('link', { name: 'Open In Characters' }).click();
    await expect(playerPage.getByRole('heading', { name: 'Characters Workbench' })).toBeVisible();
    await expect(playerPage.getByRole('table', { name: 'Characters workbench shared' })).toBeVisible();
    await expect(playerPage.getByRole('heading', { name: `${characterName} Preview` })).toBeVisible();
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
  }
});
