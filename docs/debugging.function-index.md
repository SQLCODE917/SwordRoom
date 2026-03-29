# Debugging Function Index

This index maps each implemented runtime function in the current codebase to its expected happy-path logs in local dev and the detailed guide for sequence and failure-state analysis.

## Auth And Entry

- Home demo command submit
  - Expected happy-path logs: `WEB_HOME_DEMO_SUBMIT_START`, `WEB_API_POST_COMMAND_REQUEST`, `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_API_GET_COMMAND_STATUS_HIT`
  - Guide: [debugging.auth-and-home.md](/workspaces/hello-world-monorepo/docs/debugging.auth-and-home.md)
- Dev auth
  - Expected happy-path logs: web API logs with `actorId` and `authMode=dev`, plus `API_ACTOR_RESOLVED`
  - Guide: [debugging.auth-and-home.md](/workspaces/hello-world-monorepo/docs/debugging.auth-and-home.md)
- OIDC login redirect
  - Expected happy-path logs: `WEB_LOGIN_START`
  - Guide: [debugging.auth-and-home.md](/workspaces/hello-world-monorepo/docs/debugging.auth-and-home.md)
- OIDC callback completion
  - Expected happy-path logs: `WEB_AUTH_CALLBACK_START`, `WEB_AUTH_CALLBACK_OK`
  - Guide: [debugging.auth-and-home.md](/workspaces/hello-world-monorepo/docs/debugging.auth-and-home.md)

## Character Creation Commands

- `SaveCharacterDraft`
  - Expected happy-path logs: `WEB_CHARACTER_WIZARD_SAVE_START`, `WEB_CHARACTER_WIZARD_SAVE_PAYLOAD_BUILT`, `WEB_CHARACTER_WIZARD_SAVE_ACCEPTED`, `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_CHARACTER_WIZARD_SAVE_OK`
  - Guide: [debugging.character-creation.md](/workspaces/hello-world-monorepo/docs/debugging.character-creation.md)
- `CreateCharacterDraft`
  - Expected happy-path logs: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`
  - Guide: [debugging.character-creation.md](/workspaces/hello-world-monorepo/docs/debugging.character-creation.md)
- `SetCharacterSubAbilities`
  - Expected happy-path logs: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`
  - Guide: [debugging.character-creation.md](/workspaces/hello-world-monorepo/docs/debugging.character-creation.md)
- `ApplyStartingPackage`
  - Expected happy-path logs: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`
  - Guide: [debugging.character-creation.md](/workspaces/hello-world-monorepo/docs/debugging.character-creation.md)
- `SpendStartingExp`
  - Expected happy-path logs: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`
  - Guide: [debugging.character-creation.md](/workspaces/hello-world-monorepo/docs/debugging.character-creation.md)
- `PurchaseStarterEquipment`
  - Expected happy-path logs: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`
  - Guide: [debugging.character-creation.md](/workspaces/hello-world-monorepo/docs/debugging.character-creation.md)
- `SubmitCharacterForApproval`
  - Expected happy-path logs: `WEB_CHARACTER_WIZARD_EXECUTE_START`, `WEB_CHARACTER_WIZARD_STEP_SUBMIT_START`, `WEB_CHARACTER_WIZARD_STEP_SUBMIT_ACCEPTED`, `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_CHARACTER_WIZARD_STEP_SUBMIT_OK`, `WEB_CHARACTER_WIZARD_EXECUTE_OK`
  - Guide: [debugging.character-creation.md](/workspaces/hello-world-monorepo/docs/debugging.character-creation.md)
- Command status polling
  - Expected happy-path logs: `WEB_API_GET_COMMAND_STATUS_REQUEST`, `API_GET_COMMAND_STATUS_HIT`, `WEB_API_GET_COMMAND_STATUS_HIT`, `WEB_CHARACTER_WIZARD_STATUS_POLLED`
  - Guide: [debugging.character-creation.md](/workspaces/hello-world-monorepo/docs/debugging.character-creation.md)

## Character Sheet And Appearance

- Game actor context read
  - Expected happy-path logs: `WEB_GAME_ACTOR_CONTEXT_LOAD_START`, `WEB_API_GET_GAME_ACTOR_CONTEXT_REQUEST`, `API_GET_GAME_ACTOR_CONTEXT`, `WEB_API_GET_GAME_ACTOR_CONTEXT_OK`, `WEB_GAME_ACTOR_CONTEXT_LOAD_OK`
  - Guide: [debugging.character-sheet-and-review.md](/workspaces/hello-world-monorepo/docs/debugging.character-sheet-and-review.md)
- Character sheet load
  - Expected happy-path logs: `WEB_CHARACTER_SHEET_LOAD_START`, `WEB_API_GET_CHARACTER_REQUEST`, `API_GET_CHARACTER_HIT`, `WEB_API_GET_CHARACTER_HIT`, `WEB_CHARACTER_SHEET_LOAD_OK`
  - Guide: [debugging.character-sheet-and-review.md](/workspaces/hello-world-monorepo/docs/debugging.character-sheet-and-review.md)
- Appearance upload
  - Expected happy-path logs: `WEB_CHARACTER_SHEET_UPLOAD_START`, `WEB_API_APPEARANCE_UPLOAD_URL_REQUEST`, `API_APPEARANCE_UPLOAD_URL_ISSUED`, `WEB_API_APPEARANCE_UPLOAD_URL_OK`, `WEB_CHARACTER_SHEET_UPLOAD_BINARY_OK`, `WEB_API_POST_COMMAND_REQUEST`, `API_APPEARANCE_COMMAND_AUTHORIZED`, `API_APPEARANCE_OBJECT_VERIFIED`, `API_COMMANDLOG_ACCEPTED` or `API_COMMANDLOG_IDEMPOTENT_REPLAY`, `API_ENQUEUED` or `API_ENQUEUE_SKIPPED_REPLAY`, `WEB_CHARACTER_SHEET_UPLOAD_CONFIRM_ACCEPTED`, `WEB_CHARACTER_SHEET_UPLOAD_STATUS_POLLED`, `DISPATCH_BEGIN`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_CHARACTER_SHEET_UPLOAD_OK`
  - Guide: [debugging.character-sheet-and-review.md](/workspaces/hello-world-monorepo/docs/debugging.character-sheet-and-review.md)

## Inbox And Review

- Player inbox read
  - Expected happy-path logs: `WEB_PLAYER_INBOX_REFRESH_START`, `WEB_API_GET_PLAYER_INBOX_REQUEST`, `API_GET_PLAYER_INBOX`, `WEB_API_GET_PLAYER_INBOX_OK`, `WEB_PLAYER_INBOX_REFRESH_OK`
  - Guide: [debugging.character-sheet-and-review.md](/workspaces/hello-world-monorepo/docs/debugging.character-sheet-and-review.md)
- GM inbox read
  - Expected happy-path logs: `WEB_GM_INBOX_REFRESH_START`, `WEB_API_GET_GM_INBOX_REQUEST`, `API_GET_GM_INBOX`, `WEB_API_GET_GM_INBOX_OK`, `WEB_GM_INBOX_REFRESH_OK`
  - Guide: [debugging.character-sheet-and-review.md](/workspaces/hello-world-monorepo/docs/debugging.character-sheet-and-review.md)
- `GMReviewCharacter`
  - Expected happy-path logs: `WEB_GM_REVIEW_START`, `WEB_GM_REVIEW_ACCEPTED`, `API_POST_COMMAND_REQUEST`, `API_GM_AUTHORIZED`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_GM_REVIEW_OK`
  - Guide: [debugging.character-sheet-and-review.md](/workspaces/hello-world-monorepo/docs/debugging.character-sheet-and-review.md)
- Dispatcher worker loop
  - Expected happy-path logs: `DISPATCHER_POLL_START`, repeated `DISPATCHER_RECEIVE_BATCH`, then `DISPATCHER_MESSAGE_RECEIVED`, `DISPATCHER_MESSAGE_RESULT`, `DISPATCHER_MESSAGE_DELETED`
  - Guide: [debugging.character-sheet-and-review.md](/workspaces/hello-world-monorepo/docs/debugging.character-sheet-and-review.md)

## Architecture Review

- Monorepo boundaries, risks, and next steps
  - Guide: [architecture-review.monorepo.md](/workspaces/hello-world-monorepo/docs/architecture-review.monorepo.md)
