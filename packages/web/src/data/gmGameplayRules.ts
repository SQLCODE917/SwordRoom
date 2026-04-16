import type { GameplayInfoTopicId } from '@starter/shared';

export interface GameplayRulesContent {
  title: string;
  summary: string;
  bullets: string[];
}

export const gameplayRulesByTopicId: Record<GameplayInfoTopicId, GameplayRulesContent> = {
  SCENE_FRAME: {
    title: 'Scene Framing',
    summary: 'State what is obvious right now: place, people, mood, pressure, and the immediate prompt for action.',
    bullets: [
      'Frame only what the characters can perceive directly.',
      'Keep the focus prompt actionable and present-tense.',
      'Move back here after a resolution changes the fiction.',
    ],
  },
  PLAYER_INTENT: {
    title: 'Player Intent',
    summary: 'Players ask questions and declare what their characters do; the GM listens for the next meaningful uncertainty.',
    bullets: [
      'Intents should be in-character and fiction-first.',
      'Questions, positioning, and declarations all help set the procedure.',
      'Not every intent requires a roll or a fight.',
    ],
  },
  PROCEDURE_SELECTION: {
    title: 'Procedure Selection',
    summary: 'Choose the procedure that best matches the fiction: direct adjudication, public check, hidden check, combat, or magic.',
    bullets: [
      'Use no-roll when the outcome is not meaningfully uncertain.',
      'Use a standard check when the target can be public.',
      'Use a difficulty check when the character cannot know the true result directly.',
      'Use combat when hostile action order matters.',
    ],
  },
  NO_ROLL: {
    title: 'No-Roll Adjudication',
    summary: 'When uncertainty is not meaningful, narrate the result directly and keep the fiction moving.',
    bullets: [
      'Do not ask for dice just to fill space.',
      'State the consequence clearly and return to scene play.',
      'Use this for obvious success, obvious failure, or trivial outcomes.',
    ],
  },
  STANDARD_CHECK: {
    title: 'Standard Check',
    summary: 'Standard checks compare baseline plus 2D and modifiers against a public target score.',
    bullets: [
      'Baseline is relevant skill level plus the relevant ability bonus.',
      'If the character has no related skill, baseline is 0.',
      'Double sixes auto-succeed and double ones auto-fail.',
      'Narrate the outcome and consequences once the roll resolves.',
    ],
  },
  DIFFICULTY_CHECK: {
    title: 'Difficulty Check',
    summary: 'Difficulty checks hide the true target from the character and reveal only in-fiction perception.',
    bullets: [
      'The GM sets a base difficulty and rolls 2D secretly.',
      'The player still rolls openly for their final score.',
      'Describe only what the character can tell, not whether they mathematically succeeded.',
    ],
  },
  COMBAT_ROUND: {
    title: 'Combat Round',
    summary: 'Each round collects declarations, then resolves actions in initiative order with movement constraints.',
    bullets: [
      'Announcement order is by Intelligence, with higher INT groups declaring later.',
      'Resolution order is by Agility, mixing allies and enemies together.',
      'Delay must be declared up front to move to order zero.',
      'Actions may be cancelled, but not freely swapped.',
    ],
  },
  WEAPON_ATTACK: {
    title: 'Weapon Attack',
    summary: 'Resolve one attack context at a time: hit/evasion first, then damage if the attack lands.',
    bullets: [
      'Character vs monster uses a fixed target score.',
      'Monster vs character uses the defender evasion check.',
      'Character vs character is opposed, and ties miss.',
      'Keep the attack context aligned with who is acting on whom.',
    ],
  },
  DAMAGE: {
    title: 'Damage',
    summary: 'Apply the result to LP, update statuses, and keep the table aware of who is still ready to act.',
    bullets: [
      'Reduce LP only when the resolved damage is greater than zero.',
      'NPCs drop to defeated at zero LP.',
      'Player-side combatants become unconscious at zero LP.',
      'Use this state to confirm the aftermath before continuing the round.',
    ],
  },
  AFTERMATH: {
    title: 'Aftermath',
    summary: 'Use aftermath to make consequences visible, settle the room, and return to scene-level play.',
    bullets: [
      'Show injuries, retreat, fear, loot, or social fallout.',
      'Reset the table’s attention from turn order back to fiction.',
      'A good aftermath summary makes the next scene prompt obvious.',
    ],
  },
  MAGIC: {
    title: 'Magic',
    summary: 'Magic is a branching modality: use it to decide whether the spell resolves like a standard check or inside combat.',
    bullets: [
      'Keep the spell fiction clear before choosing the procedure.',
      'Magic outside combat usually falls back to a check.',
      'Magic in active conflict should stay aligned with combat timing.',
    ],
  },
};
