import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createLibraryCharacter, createSyntheticActor, myCharactersRow, openAuthenticatedPage } from './support/app';

const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X6wAAAABJRU5ErkJggg==';

test.describe.configure({ mode: 'parallel' });

test('uploads a portrait image for a saved character', async ({ browser }, testInfo) => {
  const player = createSyntheticActor('portrait-player', testInfo);
  const characterName = `Portrait ${Date.now().toString(36)}`;

  const { context, page } = await openAuthenticatedPage(browser, player);

  try {
    await createLibraryCharacter(page, characterName);

    await page.goto('/');
    await myCharactersRow(page, characterName).getByRole('link', { name: 'Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Character Sheet' })).toBeVisible();

    const imagePath = testInfo.outputPath('portrait.png');
    await writeFile(imagePath, Buffer.from(tinyPngBase64, 'base64'));

    await page.locator('input[type="file"]').setInputFiles(imagePath);

    await expect(page.getByAltText('Character portrait preview')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Upload failed:', { exact: false })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
