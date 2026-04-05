import { expect, test } from '@playwright/test';
import { createSyntheticActor, loginDevAccount, logout, registerDevAccount } from './support/app';

test.describe.configure({ mode: 'parallel' });

test('registers a local account, logs out, and logs back in', async ({ page }, testInfo) => {
  const account = createSyntheticActor('auth-user', testInfo);
  const actorId = await registerDevAccount(page, account.username, account.password ?? 'pw');
  const signedInPattern = new RegExp(`Signed in as ${escapeRegex(actorId)}`);

  await expect(page.getByText(signedInPattern)).toBeVisible();

  await logout(page);
  await loginDevAccount(page, account.username, account.password ?? 'pw');

  await expect(page.getByText(signedInPattern)).toBeVisible();
});

test('stays signed in after a browser reload in dev auth', async ({ page }, testInfo) => {
  const account = createSyntheticActor('auth-reload', testInfo);
  const actorId = await registerDevAccount(page, account.username, account.password ?? 'pw');
  const signedInPattern = new RegExp(`Signed in as ${escapeRegex(actorId)}`);

  await page.reload();

  await expect(page.getByText(signedInPattern)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Account' })).toBeVisible();
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
