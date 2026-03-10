import type { HandlerRegistry } from './types.js';
import { applyStartingPackageHandler } from './character/applyStartingPackage.js';
import { confirmAppearanceUploadHandler } from './character/confirmAppearanceUpload.js';
import { createDraftHandler } from './character/createDraft.js';
import { gmReviewHandler } from './character/gmReview.js';
import { purchaseStarterEquipmentHandler } from './character/purchaseStarterEquipment.js';
import { saveDraftHandler } from './character/saveWizardProgress.js';
import { setSubAbilitiesHandler } from './character/setSubAbilities.js';
import { spendStartingExpHandler } from './character/spendStartingExp.js';
import { submitForApprovalHandler } from './character/submitForApproval.js';
import { acceptGameInviteHandler } from './game/acceptGameInvite.js';
import { createGameHandler } from './game/createGame.js';
import { invitePlayerToGameByEmailHandler } from './game/invitePlayerToGameByEmail.js';
import { rejectGameInviteHandler } from './game/rejectGameInvite.js';
import { setGameVisibilityHandler } from './game/setGameVisibility.js';

export const handlerRegistry: HandlerRegistry = {
  CreateGame: createGameHandler,
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
  SubmitCharacterForApproval: submitForApprovalHandler,
  GMReviewCharacter: gmReviewHandler,
};
