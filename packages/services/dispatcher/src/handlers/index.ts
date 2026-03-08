import type { HandlerRegistry } from './types.js';
import { applyStartingPackageHandler } from './character/applyStartingPackage.js';
import { confirmAppearanceUploadHandler } from './character/confirmAppearanceUpload.js';
import { createDraftHandler } from './character/createDraft.js';
import { gmReviewHandler } from './character/gmReview.js';
import { purchaseStarterEquipmentHandler } from './character/purchaseStarterEquipment.js';
import { setSubAbilitiesHandler } from './character/setSubAbilities.js';
import { spendStartingExpHandler } from './character/spendStartingExp.js';
import { submitForApprovalHandler } from './character/submitForApproval.js';

export const handlerRegistry: HandlerRegistry = {
  CreateCharacterDraft: createDraftHandler,
  SetCharacterSubAbilities: setSubAbilitiesHandler,
  ApplyStartingPackage: applyStartingPackageHandler,
  SpendStartingExp: spendStartingExpHandler,
  PurchaseStarterEquipment: purchaseStarterEquipmentHandler,
  ConfirmCharacterAppearanceUpload: confirmAppearanceUploadHandler,
  SubmitCharacterForApproval: submitForApprovalHandler,
  GMReviewCharacter: gmReviewHandler,
};
