import { useEffect, useState } from 'react';
import { readGameplayStepDescriptor, type GameplayCombatActionType, type GameplayMovementMode, type GameplayNodeId, type GameplayProcedure } from '@starter/shared';
import type { GameplayView } from '../api/ApiClient';

const attackContextOptions = ['CHARACTER_TO_MONSTER', 'MONSTER_TO_CHARACTER', 'CHARACTER_TO_CHARACTER'] as const;

export function useGmGameplayFormState(gameplay: GameplayView | null) {
  const currentRound = gameplay?.session.combat?.rounds[gameplay.session.combat.rounds.length - 1] ?? null;
  const selectedAction = currentRound?.declaredActions[currentRound.declaredActions.length - 1] ?? null;
  const actorCombatant =
    gameplay?.session.combatants.find((combatant) => combatant.combatantId === selectedAction?.actorCombatantId) ?? null;
  const targetCombatant =
    gameplay?.session.combatants.find((combatant) => combatant.combatantId === selectedAction?.targetCombatantId) ?? null;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [procedure, setProcedure] = useState<GameplayProcedure>('STANDARD_CHECK');
  const [actionLabel, setActionLabel] = useState('Intervene with authority');
  const [baselineScore, setBaselineScore] = useState('4');
  const [modifiers, setModifiers] = useState('0');
  const [targetScore, setTargetScore] = useState('10');
  const [difficulty, setDifficulty] = useState('5');
  const [publicPrompt, setPublicPrompt] = useState('The heroes push back against the Brando family in full view of the room.');
  const [gmPrompt, setGmPrompt] = useState('Keep the Brando family pressure visible while hiding the difficulty number.');
  const [playerRollTotal, setPlayerRollTotal] = useState('8');
  const [gmRollTotal, setGmRollTotal] = useState('6');
  const [publicNarration, setPublicNarration] = useState('The table sees the heroes seize the initiative.');
  const [gmNarration, setGmNarration] = useState('Hidden difficulty reveals whether the Brando family loses nerve.');
  const [combatSummary, setCombatSummary] = useState('Steel leaves its scabbard and the tavern becomes a battlefield.');
  const [resolveActionId, setResolveActionId] = useState('');
  const [resolveActorCombatantId, setResolveActorCombatantId] = useState('');
  const [resolveTargetCombatantId, setResolveTargetCombatantId] = useState('');
  const [resolveAttackContext, setResolveAttackContext] = useState<(typeof attackContextOptions)[number]>('CHARACTER_TO_MONSTER');
  const [attackerBase, setAttackerBase] = useState('8');
  const [attackerRoll, setAttackerRoll] = useState('8');
  const [fixedTargetScore, setFixedTargetScore] = useState('9');
  const [defenderBase, setDefenderBase] = useState('8');
  const [defenderRoll, setDefenderRoll] = useState('7');
  const [baseDamage, setBaseDamage] = useState('7');
  const [bonusDamage, setBonusDamage] = useState('2');
  const [defenseValue, setDefenseValue] = useState('1');
  const [damageReduction, setDamageReduction] = useState('0');
  const [combatNarration, setCombatNarration] = useState('A clean hit lands and the target staggers into the tables.');
  const [closeSummary, setCloseSummary] = useState('The Brando family falls back and the room exhales.');
  const [gmCombatActorCombatantId, setGmCombatActorCombatantId] = useState('');
  const [gmCombatTargetCombatantId, setGmCombatTargetCombatantId] = useState('');
  const [gmCombatActionType, setGmCombatActionType] = useState<GameplayCombatActionType>('ATTACK');
  const [gmCombatMovementMode, setGmCombatMovementMode] = useState<GameplayMovementMode>('NORMAL');
  const [gmCombatDelay, setGmCombatDelay] = useState(false);
  const [gmCombatSummary, setGmCombatSummary] = useState('Brando Boss lunges with a club.');

  useEffect(() => {
    if (!gameplay) {
      return;
    }

    setSelectedNodeId(gameplay.session.currentNodeId);
    if (gameplay.session.selectedProcedure) {
      setProcedure(gameplay.session.selectedProcedure);
    }
    if (gameplay.session.activeCheck) {
      setActionLabel(gameplay.session.activeCheck.actionLabel);
      setBaselineScore(String(gameplay.session.activeCheck.baselineScore));
      setModifiers(String(gameplay.session.activeCheck.modifiers));
      setTargetScore(gameplay.session.activeCheck.targetScore === null ? '' : String(gameplay.session.activeCheck.targetScore));
      setDifficulty(gameplay.session.activeCheck.difficulty === null ? '' : String(gameplay.session.activeCheck.difficulty));
      setPlayerRollTotal(gameplay.session.activeCheck.playerRollTotal === null ? '' : String(gameplay.session.activeCheck.playerRollTotal));
      setGmRollTotal(gameplay.session.activeCheck.gmRollTotal === null ? '' : String(gameplay.session.activeCheck.gmRollTotal));
      setPublicNarration(gameplay.session.activeCheck.publicNarration ?? publicNarration);
      setGmNarration(gameplay.session.activeCheck.gmNarration ?? gmNarration);
    }
  }, [gameplay]);

  useEffect(() => {
    if (!currentRound) {
      return;
    }

    if (currentRound.declaredActions.length > 0) {
      const latest = currentRound.declaredActions[currentRound.declaredActions.length - 1]!;
      setResolveActionId(latest.actionId);
      setResolveActorCombatantId(latest.actorCombatantId);
      setResolveTargetCombatantId(latest.targetCombatantId ?? '');
    }

    const gmActor =
      gameplay?.session.combatants.find((combatant) => combatant.side === 'NPC' && combatant.status === 'READY') ??
      gameplay?.session.combatants.find((combatant) => combatant.status === 'READY') ??
      null;
    const gmTarget =
      gameplay?.session.combatants.find((combatant) => combatant.side === 'PLAYER' && combatant.status === 'READY') ??
      gameplay?.session.combatants.find((combatant) => combatant.combatantId !== gmActor?.combatantId && combatant.status === 'READY') ??
      null;

    if (gmActor) {
      setGmCombatActorCombatantId(gmActor.combatantId);
    }
    if (gmTarget) {
      setGmCombatTargetCombatantId(gmTarget.combatantId);
    }
  }, [currentRound, gameplay?.session.combatants]);

  useEffect(() => {
    if (!actorCombatant) {
      return;
    }

    setResolveAttackContext(readDefaultAttackContext(actorCombatant.side, targetCombatant?.side ?? null));
    setAttackerBase(String(actorCombatant.stats.attackBase));
    setBaseDamage(String(actorCombatant.stats.strikeBase));
    setBonusDamage(String(actorCombatant.stats.bonusDamage));
  }, [actorCombatant, targetCombatant?.side]);

  useEffect(() => {
    if (!targetCombatant) {
      return;
    }

    setFixedTargetScore(String(targetCombatant.stats.evasionBase));
    setDefenderBase(String(targetCombatant.stats.evasionBase));
    setDefenseValue(String(targetCombatant.stats.defenseValue));
    setDamageReduction(String(targetCombatant.stats.damageReduction));
  }, [targetCombatant]);

  function syncSelectedNode(nodeId: GameplayNodeId) {
    setSelectedNodeId(nodeId);
    const descriptor = readGameplayStepDescriptor(nodeId);
    if (descriptor.defaultProcedure) {
      setProcedure(descriptor.defaultProcedure);
    }
  }

  return {
    selectedNodeId,
    setSelectedNodeId: syncSelectedNode,
    procedureForm: {
      procedure,
      setProcedure,
      actionLabel,
      setActionLabel,
      baselineScore,
      setBaselineScore,
      modifiers,
      setModifiers,
      targetScore,
      setTargetScore,
      difficulty,
      setDifficulty,
      publicPrompt,
      setPublicPrompt,
      gmPrompt,
      setGmPrompt,
    },
    checkResolutionForm: {
      playerRollTotal,
      setPlayerRollTotal,
      gmRollTotal,
      setGmRollTotal,
      publicNarration,
      setPublicNarration,
      gmNarration,
      setGmNarration,
    },
    combatOpenForm: {
      combatSummary,
      setCombatSummary,
    },
    gmCombatDeclarationForm: {
      gmCombatActorCombatantId,
      setGmCombatActorCombatantId,
      gmCombatTargetCombatantId,
      setGmCombatTargetCombatantId,
      gmCombatActionType,
      setGmCombatActionType,
      gmCombatMovementMode,
      setGmCombatMovementMode,
      gmCombatDelay,
      setGmCombatDelay,
      gmCombatSummary,
      setGmCombatSummary,
    },
    combatResolutionForm: {
      resolveActionId,
      setResolveActionId,
      resolveActorCombatantId,
      setResolveActorCombatantId,
      resolveTargetCombatantId,
      setResolveTargetCombatantId,
      resolveAttackContext,
      setResolveAttackContext,
      attackerBase,
      setAttackerBase,
      attackerRoll,
      setAttackerRoll,
      fixedTargetScore,
      setFixedTargetScore,
      defenderBase,
      setDefenderBase,
      defenderRoll,
      setDefenderRoll,
      baseDamage,
      setBaseDamage,
      bonusDamage,
      setBonusDamage,
      defenseValue,
      setDefenseValue,
      damageReduction,
      setDamageReduction,
      combatNarration,
      setCombatNarration,
    },
    closeCombatForm: {
      closeSummary,
      setCloseSummary,
    },
  };
}

function readDefaultAttackContext(actorSide: string | null, targetSide: string | null): (typeof attackContextOptions)[number] {
  if (actorSide === 'PLAYER' && targetSide === 'NPC') {
    return 'CHARACTER_TO_MONSTER';
  }
  if (actorSide === 'NPC' && targetSide === 'PLAYER') {
    return 'MONSTER_TO_CHARACTER';
  }
  return 'CHARACTER_TO_CHARACTER';
}
