import type { HandlerRegistry } from './types.js';
import { applyStartingPackageHandler } from './character/applyStartingPackage.js';
import { confirmAppearanceUploadHandler } from './character/confirmAppearanceUpload.js';
import { createDraftHandler } from './character/createDraft.js';
import { deleteCharacterHandler } from './character/deleteCharacter.js';
import { gmReviewHandler } from './character/gmReview.js';
import { purchaseStarterEquipmentHandler } from './character/purchaseStarterEquipment.js';
import { saveDraftHandler } from './character/saveWizardProgress.js';
import { setSubAbilitiesHandler } from './character/setSubAbilities.js';
import { spendStartingExpHandler } from './character/spendStartingExp.js';
import { submitForApprovalHandler } from './character/submitForApproval.js';
import { acceptGameInviteHandler } from './game/acceptGameInvite.js';
import { archiveGameHandler } from './game/archiveGame.js';
import { createGameHandler } from './game/createGame.js';
import { invitePlayerToGameByEmailHandler } from './game/invitePlayerToGameByEmail.js';
import { rejectGameInviteHandler } from './game/rejectGameInvite.js';
import { sendGameChatMessageHandler } from './game/sendGameChatMessage.js';
import { setGameVisibilityHandler } from './game/setGameVisibility.js';
import {
  gmCloseCombatHandler,
  gmFrameGameplaySceneHandler,
  gmOpenCombatRoundHandler,
  gmResolveCombatTurnHandler,
  gmResolveGameplayCheckHandler,
  gmSelectGameplayProcedureHandler,
  submitCombatActionHandler,
  submitGameplayIntentHandler,
} from './gameplay/gameplayCommands.js';

export const handlerRegistry: HandlerRegistry = {
  CreateGame: createGameHandler,
  ArchiveGame: archiveGameHandler,
  SetGameVisibility: setGameVisibilityHandler,
  InvitePlayerToGameByEmail: invitePlayerToGameByEmailHandler,
  AcceptGameInvite: acceptGameInviteHandler,
  RejectGameInvite: rejectGameInviteHandler,
  SaveCharacterDraft: saveDraftHandler,
  CreateCharacterDraft: createDraftHandler,
  SetCharacterSubAbilities: setSubAbilitiesHandler,
  ApplyStartingPackage: applyStartingPackageHandler,
  SpendStartingExp: spendStartingExpHandler,
  PurchaseStarterEquipment: purchaseStarterEquipmentHandler,
  ConfirmCharacterAppearanceUpload: confirmAppearanceUploadHandler,
  DeleteCharacter: deleteCharacterHandler,
  SendGameChatMessage: sendGameChatMessageHandler,
  SubmitCharacterForApproval: submitForApprovalHandler,
  GMReviewCharacter: gmReviewHandler,
  GMFrameGameplayScene: gmFrameGameplaySceneHandler,
  SubmitGameplayIntent: submitGameplayIntentHandler,
  GMSelectGameplayProcedure: gmSelectGameplayProcedureHandler,
  GMResolveGameplayCheck: gmResolveGameplayCheckHandler,
  GMOpenCombatRound: gmOpenCombatRoundHandler,
  SubmitCombatAction: submitCombatActionHandler,
  GMResolveCombatTurn: gmResolveCombatTurnHandler,
  GMCloseCombat: gmCloseCombatHandler,
};
