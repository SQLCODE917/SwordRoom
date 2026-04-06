import { expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';

const DEV_ACCOUNTS_KEY = 'sw_dev_accounts_v1';
const DEV_SESSION_KEY = 'sw_dev_session_v1';

export interface DevActor {
  username: string;
  actorId: string;
  password?: string;
  displayName?: string;
}

export const builtinPlayer: DevActor = {
  username: 'player-aaa',
  actorId: 'player-aaa',
  password: 'player1234',
  displayName: 'Local Player',
};

export function createSyntheticActor(label: string, testInfo: TestInfo): DevActor {
  const token = uniqueToken(label, testInfo);
  return {
    username: token,
    actorId: `player-${token}`,
    password: `${token}-pw`,
    displayName: token,
  };
}

export async function openAuthenticatedPage(browser: Browser, actor: DevActor, path = '/'): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ actor, sessionKey, accountsKey }) => {
      window.localStorage.setItem(
        sessionKey,
        JSON.stringify({
          username: actor.username,
          actorId: actor.actorId,
        })
      );
      window.localStorage.setItem(
        accountsKey,
        JSON.stringify([
          {
            username: actor.username,
            password: actor.password ?? `${actor.username}-pw`,
            actorId: actor.actorId,
            displayName: actor.displayName ?? actor.username,
          },
        ])
      );
    },
    {
      actor,
      sessionKey: DEV_SESSION_KEY,
      accountsKey: DEV_ACCOUNTS_KEY,
    }
  );

  const page = await context.newPage();
  await ensureSignedIn(page);
  if (path !== '/') {
    await page.goto(path);
  }
  return { context, page };
}

export async function registerDevAccount(page: Page, username: string, password: string): Promise<string> {
  await page.goto('/login');
  await expect(page.getByText('Sign in with a local dev account or register a new one.')).toBeVisible();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await ensureSignedIn(page);
  return readActorId(page);
}

export async function loginDevAccount(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/login');
  await expect(page.getByLabel('Username')).toBeVisible();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await ensureSignedIn(page);
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
}

export async function createGame(page: Page, name: string): Promise<string> {
  await page.goto('/gm/games');
  await expect(page.getByRole('heading', { name: 'GM Games' })).toBeVisible();
  await page.getByLabel('New game name').fill(name);
  await page.getByRole('button', { name: 'Create Game' }).click();
  const row = gmGamesRow(page, name);
  await expect(row).toBeVisible();
  const gmInboxHref = await row.getByRole('link', { name: 'GM Inbox' }).getAttribute('href');
  if (!gmInboxHref) {
    throw new Error(`missing GM Inbox route for game "${name}"`);
  }
  return decodeURIComponent(gmInboxHref.split('/')[2] ?? '');
}

export async function setGameVisibility(page: Page, name: string, visibility: 'PUBLIC' | 'PRIVATE'): Promise<void> {
  await page.goto('/gm/games');
  const row = gmGamesRow(page, name);
  await expect(row).toBeVisible();
  if ((await row.textContent())?.includes(visibility)) {
    return;
  }
  await row.getByRole('button', { name: visibility === 'PUBLIC' ? 'Make Public' : 'Make Private' }).click();
  await expect(row).toContainText(visibility);
}

export async function invitePlayer(page: Page, gameName: string, email: string): Promise<void> {
  await page.goto('/gm/games');
  const row = gmGamesRow(page, gameName);
  await expect(row).toBeVisible();
  await row.getByRole('textbox').fill(email);
  await row.getByRole('button', { name: 'Invite Player' }).click();
  await expect(row.getByRole('textbox')).toHaveValue('');
}

export async function deleteGame(page: Page, gameName: string): Promise<void> {
  await page.goto('/gm/games');
  const row = gmGamesRow(page, gameName);
  await expect(row).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(row).toHaveCount(0);
}

export async function createLibraryCharacter(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('table', { name: 'My Characters' })).toBeVisible();
  await page.getByRole('link', { name: 'New Character' }).click();
  await autofillCharacterWizard(page, name);
  await openWizardSubmitStep(page);
  await page.getByRole('button', { name: /^Create Character$/ }).click();
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('table', { name: 'My Characters' }).getByText(name, { exact: true })).toBeVisible();
}

export async function applyToJoinWithNewCharacter(page: Page, gameName: string, characterName: string): Promise<void> {
  await page.goto('/');
  await publicGamesRow(page, gameName).getByRole('link', { name: 'Apply to Join' }).click();
  await autofillCharacterWizard(page, characterName);
  await openWizardSubmitStep(page);
  await page.getByRole('button', { name: /^Submit Character For Approval$/ }).click();
  await expect(page.getByRole('button', { name: 'Submitted For Review' })).toBeVisible();
}

export async function applyToJoinWithSavedCharacter(page: Page, gameName: string, characterName: string): Promise<void> {
  await page.goto('/');
  await publicGamesRow(page, gameName).getByRole('link', { name: 'Apply to Join' }).click();
  await selectSavedCharacter(page, characterName);
  await openWizardSubmitStep(page);
  await page.getByRole('button', { name: /^Submit Character For Approval$/ }).click();
  await expect(page.getByRole('button', { name: 'Submitted For Review' })).toBeVisible();
}

export async function approvePendingCharacter(page: Page, gameId: string, ownerPlayerId: string): Promise<void> {
  await page.goto(`/gm/${encodeURIComponent(gameId)}/inbox`);
  await expect(page.getByRole('heading', { name: 'GM Inbox' })).toBeVisible();
  const row = page.getByRole('table', { name: 'GM Pending Characters' }).getByRole('row').filter({ hasText: ownerPlayerId }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(row).toHaveCount(0);
}

export async function acceptInvite(page: Page, gameName: string): Promise<void> {
  await page.goto('/me/inbox');
  const row = playerInboxRow(page, gameName);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: 'Accept' }).click();
  await expect(row).toHaveCount(0);
}

export async function openChatFromMyGames(page: Page, gameName: string): Promise<void> {
  await page.goto('/');
  await myGamesRow(page, gameName).getByRole('link', { name: 'Chat' }).click();
  await expect(page.getByRole('heading', { name: 'Game Chat' })).toBeVisible();
}

export async function sendChatMessage(page: Page, body: string): Promise<void> {
  await page.getByLabel('Message').fill(body);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
}

export async function ensureSignedIn(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.c-note .t-small').filter({ hasText: /^Signed in as / }).first()).toBeVisible({
    timeout: 40_000,
  });
}

export function myGamesRow(page: Page, gameName: string): Locator {
  return rowInTable(page, 'My Games', gameName);
}

export function myCharactersRow(page: Page, characterName: string): Locator {
  return rowInTable(page, 'My characters', characterName);
}

export function publicGamesRow(page: Page, gameName: string): Locator {
  return rowInTable(page, 'Public Games', gameName);
}

export function gmGamesRow(page: Page, gameName: string): Locator {
  return rowInTable(page, 'GM games', gameName);
}

export function playerInboxRow(page: Page, gameName: string): Locator {
  return rowInTable(page, 'Player Inbox Items', gameName);
}

function rowInTable(page: Page, tableName: string, text: string): Locator {
  return page.getByRole('table', { name: tableName }).getByRole('row').filter({ hasText: text }).first();
}

async function autofillCharacterWizard(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name: /Character Wizard|Create Personal Character|Edit Character Draft/ })).toBeVisible();
  await page.getByRole('button', { name: 'Autofill from fixture' }).click();
  await page.getByRole('textbox', { name: /^Name$/ }).fill(name);
}

async function selectSavedCharacter(page: Page, characterName: string): Promise<void> {
  const select = page.getByLabel('Autofill from saved character');
  await expect(select).toBeVisible();
  const optionValue = await select.locator('option').evaluateAll((options, targetName) => {
    const match = options.find((option) => option.textContent?.trim().startsWith(targetName));
    return match instanceof HTMLOptionElement ? match.value : null;
  }, characterName);
  if (!optionValue) {
    throw new Error(`saved character option not found for "${characterName}"`);
  }
  await select.selectOption(optionValue);
}

async function openWizardSubmitStep(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^7\)\s*Submit$/ }).click();
}

async function readActorId(page: Page): Promise<string> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), DEV_SESSION_KEY);
  if (!raw) {
    throw new Error('missing dev session after registration');
  }
  const parsed = JSON.parse(raw) as { actorId?: unknown };
  if (typeof parsed.actorId !== 'string' || parsed.actorId.trim() === '') {
    throw new Error('dev session did not contain an actorId');
  }
  return parsed.actorId;
}

function uniqueToken(label: string, testInfo: TestInfo): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'actor';
  return `${slug}-${testInfo.parallelIndex}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
