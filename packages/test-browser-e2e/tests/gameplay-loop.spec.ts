import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  applyToJoinWithNewCharacter,
  approvePendingCharacter,
  createGame,
  createSyntheticActor,
  gmCloseCombat,
  gmDeclareCombatAction,
  gmOpenCombat,
  openGmControlPanel,
  openGmUtility,
  gmResolveCheck,
  gmResolveCombatTurn,
  gmSelectProcedure,
  loadRpgSample,
  openAuthenticatedPage,
  openGmPlay,
  openPlayerPlay,
  postCommandAsCurrentActor,
  sendChatMessage,
  setGameVisibility,
  submitCombatActionFromPlay,
  submitIntentFromPlay,
  switchGmPlayMode,
  waitForCommandStatus,
} from './support/app';

test.describe.configure({ mode: 'parallel' });

test('keeps GM play focused on Current Step while preserving mobile chat, graph, and utilities', async ({
  browser,
}, testInfo) => {
  const gm = createSyntheticActor('gm-play-redesign', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Gameplay Redesign ${testInfo.parallelIndex} ${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);

  try {
    const gameId = await createGame(gmPage, gameName);

    await gmPage.setViewportSize({ width: 390, height: 844 });
    await openGmPlay(gmPage, gameId);
    await loadRpgSample(gmPage);

    await expect(gmPage.getByRole('heading', { name: 'Current Step' })).toBeVisible();
    await expect(gmPage).toHaveURL(/mode=control/);
    await expect(gmPage).toHaveURL(/panel=step/);

    const transcriptSheet = await openGmUtility(gmPage, 'transcript');
    await expect(transcriptSheet.getByLabel('Transcript view')).toBeVisible();
    await transcriptSheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(gmPage).not.toHaveURL(/utility=/);

    await openGmControlPanel(gmPage, 'graph');
    await expect(gmPage.getByRole('list', { name: 'Gameplay stages' })).toBeVisible();
    await gmPage.reload();
    await expect(gmPage.getByRole('list', { name: 'Gameplay stages' })).toBeVisible();

    await switchGmPlayMode(gmPage, 'chat');
    await expect(gmPage.getByRole('button', { name: 'Back to Control Center' })).toBeVisible();
    await gmPage.reload();
    await expect(gmPage.getByRole('button', { name: 'Back to Control Center' })).toBeVisible();
  } finally {
    await gmContext.close();
  }
});

test('seeds the tavern sample in GM and player play views with integrated chat and adaptive graph', async ({
  browser,
}, testInfo) => {
  const gm = createSyntheticActor('gm-play-smoke', testInfo);
  const player = createSyntheticActor('player-play-smoke', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Gameplay Smoke ${testInfo.parallelIndex} ${token}`;
  const characterName = `Ari ${token}`;
  const chatBody = `ready-for-tavern-${token}`;

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: playerContext, page: playerPage } = await openAuthenticatedPage(browser, player);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await applyToJoinWithNewCharacter(playerPage, gameName, characterName);
    await approvePendingCharacter(gmPage, gameId, player.actorId);

    await openGmPlay(gmPage, gameId);
    await loadRpgSample(gmPage);
    await expect(gmPage.getByRole('heading', { name: 'Current Step' })).toBeVisible();
    await openGmControlPanel(gmPage, 'graph');
    await expect(gmPage.getByLabel('Gameplay graph', { exact: true })).toBeVisible();

    await gmPage.setViewportSize({ width: 390, height: 844 });
    await openGmControlPanel(gmPage, 'graph');
    await expect(gmPage.getByRole('list', { name: 'Gameplay stages' })).toBeVisible();

    await openPlayerPlay(playerPage, gameId);
    await expect(playerPage.getByLabel('Current scene').getByRole('heading', { name: 'Tavern At Sundown' })).toBeVisible();
    await expect(playerPage.getByRole('heading', { name: 'Game Chat' })).toBeVisible();

    await sendChatMessage(playerPage, chatBody);
    await switchGmPlayMode(gmPage, 'chat');
    await gmPage.reload();
    await expect(gmPage.getByText(chatBody, { exact: true })).toBeVisible({ timeout: 15_000 });
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
  }
});

test('executes public checks, hidden checks, combat declarations, and combat resolution through the gameplay loop', async ({
  browser,
}, testInfo) => {
  const gm = createSyntheticActor('gm-play-full', testInfo);
  const playerA = createSyntheticActor('player-a', testInfo);
  const playerB = createSyntheticActor('player-b', testInfo);
  const playerC = createSyntheticActor('player-c', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Gameplay Full ${testInfo.parallelIndex} ${token}`;
  const charA = `Asha ${token}`;
  const charB = `Borin ${token}`;
  const charC = `Cyra ${token}`;
  const standardNarration = `${charA} cuts through the noise and steadies the room.`;
  const hiddenNarration = 'Brando Boss narrows his eyes and reevaluates the heroes.';
  const gmHiddenNarration = 'Hidden target 11: the Brando family has not fully committed yet.';
  const combatNarration = `${charA} drives Brando Boss back across the tavern floor.`;
  const closeSummary = 'The Brando family withdraws and the tavern breathes again.';

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const { context: aContext, page: aPage } = await openAuthenticatedPage(browser, playerA);
  const { context: bContext, page: bPage } = await openAuthenticatedPage(browser, playerB);
  const { context: cContext, page: cPage } = await openAuthenticatedPage(browser, playerC);

  try {
    const gameId = await createGame(gmPage, gameName);
    await setGameVisibility(gmPage, gameName, 'PUBLIC');

    await applyToJoinWithNewCharacter(aPage, gameName, charA);
    await applyToJoinWithNewCharacter(bPage, gameName, charB);
    await applyToJoinWithNewCharacter(cPage, gameName, charC);

    await approvePendingCharacter(gmPage, gameId, playerA.actorId);
    await approvePendingCharacter(gmPage, gameId, playerB.actorId);
    await approvePendingCharacter(gmPage, gameId, playerC.actorId);

    await openGmPlay(gmPage, gameId);
    await loadRpgSample(gmPage);

    await openPlayerPlay(aPage, gameId);
    await openPlayerPlay(bPage, gameId);
    await openPlayerPlay(cPage, gameId);

    await submitIntentFromPlay(aPage, `${charA} steps between the thugs and the poster girl.`);
    await submitIntentFromPlay(bPage, `${charB} studies Brando Boss for an opening.`);
    await submitIntentFromPlay(cPage, `${charC} shifts toward a chair and readies for trouble.`);

    await gmPage.reload();
    const publicTranscript = await openGmUtility(gmPage, 'transcript');
    await expect(publicTranscript).toContainText('declares an intent');
    await gmPage.getByRole('button', { name: 'Close' }).click();

    await gmSelectProcedure(gmPage, {
      procedure: 'STANDARD_CHECK',
      actionLabel: 'Calm the room',
      baselineScore: '4',
      modifiers: '0',
      targetScore: '10',
      publicPrompt: 'The table can see the target for this social push.',
      gmPrompt: 'Use the standard tavern sample math.',
    });
    await gmResolveCheck(gmPage, {
      playerRollTotal: '8',
      publicNarration: standardNarration,
      gmNarration: 'Public target 10 met.',
    });

    await aPage.reload();
    await expect(aPage.getByLabel('Public Transcript')).toContainText(standardNarration);

    await submitIntentFromPlay(bPage, `${charB} leans in and studies Brando Boss for a hidden tell.`);
    await gmPage.reload();
    await gmSelectProcedure(gmPage, {
      procedure: 'DIFFICULTY_CHECK',
      actionLabel: 'Read the Brando family',
      baselineScore: '3',
      modifiers: '0',
      difficulty: '5',
      publicPrompt: 'The heroes can only read the fiction, not the hidden target.',
      gmPrompt: 'Run the hidden difficulty version from the tavern sample.',
    });
    await gmResolveCheck(gmPage, {
      playerRollTotal: '7',
      gmRollTotal: '6',
      publicNarration: hiddenNarration,
      gmNarration: gmHiddenNarration,
    });

    await aPage.reload();
    await expect(aPage.getByLabel('Public Transcript')).toContainText(hiddenNarration);
    await expect(aPage.getByText(gmHiddenNarration)).toHaveCount(0);
    const gmTranscript = await openGmUtility(gmPage, 'transcript');
    await gmTranscript.getByRole('tab', { name: 'GM' }).click();
    await expect(gmTranscript).toContainText(gmHiddenNarration);
    await gmPage.getByRole('button', { name: 'Close' }).click();

    await submitIntentFromPlay(aPage, `${charA} draws steel as the Brando family closes in.`);
    await gmPage.reload();
    await gmSelectProcedure(gmPage, {
      procedure: 'COMBAT',
      actionLabel: 'Tavern brawl erupts',
      baselineScore: '0',
      modifiers: '0',
      publicPrompt: 'Weapons flash and tavern tables scatter.',
      gmPrompt: 'Escalate the tavern sample into combat timing.',
    });
    await gmOpenCombat(gmPage, 'Weapons flash and tavern tables scatter.');
    await Promise.all([aPage.reload(), bPage.reload(), cPage.reload()]);

    await submitCombatActionFromPlay(aPage, {
      targetName: 'Brando Boss',
      summary: `${charA} charges Brando Boss.`,
    });
    await submitCombatActionFromPlay(bPage, {
      targetName: 'Brando Thug 1',
      summary: `${charB} flanks Brando Thug 1.`,
    });
    await submitCombatActionFromPlay(cPage, {
      actionType: 'DELAY',
      summary: `${charC} waits for an opening.`,
      delayToOrderZero: true,
    });
    await gmDeclareCombatAction(gmPage, {
      actorName: 'Brando Boss',
      targetName: charA,
      summary: 'Brando Boss swings a heavy club at the lead hero.',
    });

    await gmPage.reload();
    await expect(gmPage.getByRole('heading', { name: 'Round Control' })).toBeVisible();
    await expect(gmPage.getByText(`${charA} charges Brando Boss.`).first()).toBeVisible();

    await gmResolveCombatTurn(gmPage, {
      actionSummary: `${charA} charges Brando Boss.`,
      actorName: charA,
      targetName: 'Brando Boss',
      attackContext: 'CHARACTER_TO_MONSTER',
      attackerBase: '8',
      attackerRoll: '8',
      fixedTargetScore: '9',
      baseDamage: '7',
      bonusDamage: '2',
      defenseValue: '1',
      damageReduction: '0',
      narration: combatNarration,
    });

    await aPage.reload();
    await expect(aPage.getByLabel('Public Transcript')).toContainText(combatNarration);
    await expect(aPage.getByLabel('Combatants')).toContainText('LP 10/18');

    await gmCloseCombat(gmPage, closeSummary);
    await aPage.reload();
    await expect(aPage.getByLabel('Public Transcript')).toContainText(closeSummary);
  } finally {
    await Promise.all([gmContext.close(), aContext.close(), bContext.close(), cContext.close()]);
  }
});

test('keeps a GM without a character out of player-character actions while preserving GM NPC control', async ({
  browser,
}, testInfo) => {
  const gm = createSyntheticActor('gm-no-character', testInfo);
  const token = Date.now().toString(36);
  const gameName = `Gameplay GM Limits ${testInfo.parallelIndex} ${token}`;
  const blockedIntent = `blocked-intent-${token}`;
  const gmNpcSummary = `Brando Boss circles the room and sizes up the exits ${token}.`;
  const openCombatCommandId = randomUUID();

  const { context: gmContext, page: gmPage } = await openAuthenticatedPage(browser, gm);
  const gmPlayerPage = await gmContext.newPage();

  try {
    const gameId = await createGame(gmPage, gameName);

    await openGmPlay(gmPage, gameId);
    await loadRpgSample(gmPage);

    await openPlayerPlay(gmPlayerPage, gameId);

    const intentPanel = gmPlayerPage
      .locator('.c-gameplay-ops__panel')
      .filter({ has: gmPlayerPage.getByRole('heading', { name: 'Intent' }) })
      .first();
    const combatPanel = gmPlayerPage
      .locator('.c-gameplay-ops__panel')
      .filter({ has: gmPlayerPage.getByRole('heading', { name: 'Combat Action' }) })
      .first();

    await expect(intentPanel).toContainText('Join this game with an approved character to submit intents.');
    await expect(intentPanel.getByRole('textbox', { name: 'What does your character do?' })).toBeDisabled();
    await expect(intentPanel.getByRole('button', { name: 'Submit Intent' })).toBeDisabled();

    const blockedCommandId = randomUUID();
    await postCommandAsCurrentActor(gmPlayerPage, {
      commandId: blockedCommandId,
      gameId,
      type: 'SubmitGameplayIntent',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        body: blockedIntent,
        characterId: null,
      },
    });
    const blockedStatus = await waitForCommandStatus(gmPlayerPage, blockedCommandId, 20_000);
    expect(blockedStatus).toMatchObject({
      status: 'FAILED',
      errorCode: 'GAMEPLAY_CHARACTER_REQUIRED',
    });

    await gmPlayerPage.reload();
    await expect(gmPlayerPage.getByLabel('Public Transcript').getByText(blockedIntent, { exact: true })).toHaveCount(0);

    await postCommandAsCurrentActor(gmPage, {
      commandId: openCombatCommandId,
      gameId,
      type: 'GMOpenCombatRound',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        summary: 'The Brando family fans out while the GM stays out of player-character action.',
      },
    });
    const combatOpenedStatus = await waitForCommandStatus(gmPage, openCombatCommandId, 20_000);
    expect(combatOpenedStatus).toMatchObject({
      status: 'PROCESSED',
    });
    await gmPage.reload();
    await gmPlayerPage.reload();

    await expect(combatPanel.getByRole('button', { name: 'Declare Combat Action' })).toBeDisabled();
    await expect(combatPanel.getByRole('textbox', { name: 'Summary', exact: true })).toBeDisabled();

    await gmDeclareCombatAction(gmPage, {
      actorName: 'Brando Boss',
      actionType: 'MOVE',
      summary: gmNpcSummary,
    });

    await gmPage.reload();
    await expect(gmPage.getByRole('heading', { name: 'Round Control' })).toBeVisible();
    await expect(gmPage.getByText(gmNpcSummary).first()).toBeVisible();

    await gmPlayerPage.reload();
    await expect(gmPlayerPage.getByLabel('Public Transcript')).toContainText(gmNpcSummary);
  } finally {
    await gmContext.close();
  }
});
