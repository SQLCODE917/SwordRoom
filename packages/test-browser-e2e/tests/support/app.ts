import { expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';

const DEV_ACCOUNTS_KEY = 'sw_dev_accounts_v1';
const DEV_SESSION_KEY = 'sw_dev_session_v1';

export interface DevActor {
  username: string;
  actorId: string;
  password?: string;
  displayName?: string;
}

export interface BrowserPostedCommand {
  accepted: true;
  commandId: string;
  status: string;
}

export interface BrowserCommandStatus {
  commandId: string;
  status: 'ACCEPTED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  errorCode: string | null;
  errorMessage: string | null;
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

export async function openPlayerPlay(page: Page, gameId: string): Promise<void> {
  await page.goto(`/games/${encodeURIComponent(gameId)}/play`);
  await expect(page.getByRole('heading', { name: 'Player Play' })).toBeVisible();
}

export async function openGmPlay(page: Page, gameId: string): Promise<void> {
  await page.goto(`/gm/${encodeURIComponent(gameId)}/play`);
  await expect(page.getByRole('heading', { name: 'GM Play' })).toBeVisible();
}

export async function loadRpgSample(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Load RPG Sample' }).first().click();
  await expect(page.getByRole('heading', { name: 'Tavern At Sundown' })).toBeVisible();
}

export async function submitIntentFromPlay(page: Page, body: string): Promise<void> {
  const panel = gameplayPanel(page, 'Intent');
  await panel.getByRole('textbox', { name: 'What does your character do?' }).fill(body);
  await panel.getByRole('button', { name: 'Submit Intent' }).click();
}

export async function submitCombatActionFromPlay(
  page: Page,
  input: {
    actionType?: string;
    movementMode?: string;
    targetName?: string;
    summary: string;
    delayToOrderZero?: boolean;
  }
): Promise<void> {
  const panel = gameplayPanel(page, 'Combat Action');
  if (input.actionType) {
    await panel.getByRole('combobox', { name: 'Action', exact: true }).selectOption(input.actionType);
  }
  if (input.movementMode) {
    await panel.getByRole('combobox', { name: 'Movement', exact: true }).selectOption(input.movementMode);
  }
  if (input.targetName) {
    await panel.getByRole('combobox', { name: 'Target', exact: true }).selectOption({ label: input.targetName });
  }
  if (input.delayToOrderZero) {
    await panel.getByRole('checkbox', { name: 'Delay to order zero' }).check();
  }
  await panel.getByRole('textbox', { name: 'Summary', exact: true }).fill(input.summary);
  await panel.getByRole('button', { name: 'Declare Combat Action' }).click();
}

export async function gmSelectProcedure(
  page: Page,
  input: {
    procedure: string;
    actionLabel: string;
    baselineScore: string;
    modifiers: string;
    targetScore?: string;
    difficulty?: string;
    publicPrompt: string;
    gmPrompt?: string;
  }
): Promise<void> {
  const panel = gameplayPanel(page, 'Procedure');
  await panel.getByRole('combobox', { name: 'Procedure', exact: true }).selectOption(input.procedure);
  await panel.getByRole('textbox', { name: 'Action label', exact: true }).fill(input.actionLabel);
  await panel.getByRole('textbox', { name: 'Baseline', exact: true }).fill(input.baselineScore);
  await panel.getByRole('textbox', { name: 'Modifiers', exact: true }).fill(input.modifiers);
  if (input.targetScore !== undefined) {
    await panel.getByRole('textbox', { name: 'Target', exact: true }).fill(input.targetScore);
  }
  if (input.difficulty !== undefined) {
    await panel.getByRole('textbox', { name: 'Difficulty', exact: true }).fill(input.difficulty);
  }
  await panel.getByRole('textbox', { name: 'Public prompt', exact: true }).fill(input.publicPrompt);
  await panel.getByRole('textbox', { name: 'GM prompt', exact: true }).fill(input.gmPrompt ?? '');
  await panel.getByRole('button', { name: 'Select Procedure' }).click();
}

export async function gmResolveCheck(
  page: Page,
  input: {
    playerRollTotal?: string;
    gmRollTotal?: string;
    publicNarration: string;
    gmNarration?: string;
  }
): Promise<void> {
  const panel = gameplayPanel(page, 'Resolve Check');
  if (input.playerRollTotal !== undefined) {
    await panel.getByRole('textbox', { name: 'Player roll', exact: true }).fill(input.playerRollTotal);
  }
  if (input.gmRollTotal !== undefined) {
    await panel.getByRole('textbox', { name: 'GM roll', exact: true }).fill(input.gmRollTotal);
  }
  await panel.getByRole('textbox', { name: 'Public narration', exact: true }).fill(input.publicNarration);
  await panel.getByRole('textbox', { name: 'GM narration', exact: true }).fill(input.gmNarration ?? '');
  await panel.getByRole('button', { name: 'Resolve Check' }).click();
}

export async function gmOpenCombat(page: Page, summary: string): Promise<void> {
  const panel = gameplayPanel(page, 'Open Combat');
  await panel.getByRole('textbox', { name: 'Combat summary', exact: true }).fill(summary);
  await panel.getByRole('button', { name: 'Open Combat Round' }).click();
}

export async function gmDeclareCombatAction(
  page: Page,
  input: {
    actorName: string;
    targetName?: string;
    actionType?: string;
    movementMode?: string;
    summary: string;
    delayToOrderZero?: boolean;
  }
): Promise<void> {
  const panel = gameplayPanel(page, 'GM Combat Declaration');
  await panel.getByRole('combobox', { name: 'Actor combatant', exact: true }).selectOption({ label: input.actorName });
  if (input.targetName) {
    await panel.getByRole('combobox', { name: 'Target combatant', exact: true }).selectOption({ label: input.targetName });
  }
  if (input.actionType) {
    await panel.getByRole('combobox', { name: 'Action', exact: true }).selectOption(input.actionType);
  }
  if (input.movementMode) {
    await panel.getByRole('combobox', { name: 'Movement', exact: true }).selectOption(input.movementMode);
  }
  if (input.delayToOrderZero) {
    await panel.getByRole('checkbox', { name: 'Delay to order zero' }).check();
  }
  await panel.getByRole('textbox', { name: 'Summary', exact: true }).fill(input.summary);
  await panel.getByRole('button', { name: 'Declare Combat Action' }).click();
}

export async function gmResolveCombatTurn(
  page: Page,
  input: {
    actionSummary: string;
    actorName: string;
    targetName: string;
    attackContext: string;
    attackerBase: string;
    attackerRoll: string;
    fixedTargetScore: string;
    defenderBase?: string;
    defenderRoll?: string;
    baseDamage: string;
    bonusDamage: string;
    defenseValue: string;
    damageReduction: string;
    narration: string;
  }
): Promise<void> {
  const panel = gameplayPanel(page, 'Resolve Combat Turn');
  await panel.getByRole('combobox', { name: 'Action', exact: true }).selectOption({ label: input.actionSummary });
  await panel.getByRole('combobox', { name: 'Actor combatant', exact: true }).selectOption({ label: input.actorName });
  await panel.getByRole('combobox', { name: 'Target combatant', exact: true }).selectOption({ label: input.targetName });
  await panel.getByRole('combobox', { name: 'Attack context', exact: true }).selectOption(input.attackContext);
  await panel.getByRole('textbox', { name: 'Attacker base', exact: true }).fill(input.attackerBase);
  await panel.getByRole('textbox', { name: 'Attacker roll', exact: true }).fill(input.attackerRoll);
  await panel.getByRole('textbox', { name: 'Fixed target', exact: true }).fill(input.fixedTargetScore);
  if (input.defenderBase !== undefined) {
    await panel.getByRole('textbox', { name: 'Defender base', exact: true }).fill(input.defenderBase);
  }
  if (input.defenderRoll !== undefined) {
    await panel.getByRole('textbox', { name: 'Defender roll', exact: true }).fill(input.defenderRoll);
  }
  await panel.getByRole('textbox', { name: 'Base damage', exact: true }).fill(input.baseDamage);
  await panel.getByRole('textbox', { name: 'Bonus damage', exact: true }).fill(input.bonusDamage);
  await panel.getByRole('textbox', { name: 'Defense value', exact: true }).fill(input.defenseValue);
  await panel.getByRole('textbox', { name: 'Damage reduction', exact: true }).fill(input.damageReduction);
  await panel.getByRole('textbox', { name: 'Narration', exact: true }).fill(input.narration);
  await panel.getByRole('button', { name: 'Resolve Combat Turn' }).click();
}

export async function gmCloseCombat(page: Page, summary: string): Promise<void> {
  const panel = gameplayPanel(page, 'Close Combat');
  await panel.getByRole('textbox', { name: 'Aftermath summary', exact: true }).fill(summary);
  await panel.getByRole('button', { name: 'Close Combat' }).click();
}

export async function postCommandAsCurrentActor(
  page: Page,
  envelope: Record<string, unknown>
): Promise<BrowserPostedCommand> {
  return page.evaluate(
    async ({ envelope, sessionKey }) => {
      const raw = window.localStorage.getItem(sessionKey);
      if (!raw) {
        throw new Error('missing dev session');
      }
      const parsed = JSON.parse(raw) as { actorId?: unknown };
      if (typeof parsed.actorId !== 'string' || parsed.actorId.trim() === '') {
        throw new Error('missing actorId in dev session');
      }

      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-dev-actor-id': parsed.actorId,
        },
        body: JSON.stringify({
          envelope,
          bypassActorId: parsed.actorId,
        }),
      });
      if (!response.ok) {
        throw new Error(`command post failed with status ${response.status}`);
      }
      return (await response.json()) as BrowserPostedCommand;
    },
    {
      envelope,
      sessionKey: DEV_SESSION_KEY,
    }
  );
}

export async function waitForCommandStatus(
  page: Page,
  commandId: string,
  timeoutMs = 15_000
): Promise<BrowserCommandStatus> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await page.evaluate(
      async ({ commandId, sessionKey }) => {
        const raw = window.localStorage.getItem(sessionKey);
        if (!raw) {
          throw new Error('missing dev session');
        }
        const parsed = JSON.parse(raw) as { actorId?: unknown };
        if (typeof parsed.actorId !== 'string' || parsed.actorId.trim() === '') {
          throw new Error('missing actorId in dev session');
        }

        const response = await fetch(`/api/commands/${encodeURIComponent(commandId)}`, {
          headers: {
            'x-dev-actor-id': parsed.actorId,
          },
        });
        if (!response.ok) {
          throw new Error(`command status failed with status ${response.status}`);
        }
        return (await response.json()) as BrowserCommandStatus;
      },
      {
        commandId,
        sessionKey: DEV_SESSION_KEY,
      }
    );

    if (status.status === 'PROCESSED' || status.status === 'FAILED') {
      return status;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`command ${commandId} did not reach a terminal status within ${timeoutMs}ms`);
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

function gameplayPanel(page: Page, heading: string): Locator {
  return page.locator('.c-gameplay-ops__panel').filter({ has: page.getByRole('heading', { name: heading }) }).first();
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
