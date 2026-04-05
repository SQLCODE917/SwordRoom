# Sword World Local Dev Guide

## Local Dev Scripts

- Start the full local stack with latest local code, merged logs, TypeScript watch, service auto-restart, and Vite HMR:
  - `make dev-up`
- Stop the full local stack cleanly:
  - `make dev-down`
- While `make dev-up` is running, you can stop it with:
  - `q`
  - `Ctrl-C`
  - `bash scripts/local/dev-down.sh`
- Manual infrastructure helpers:
  - `make up`
  - `make down`
  - `make resources`
  - `make seed`
  - `make keycloak-import`
- Manual service helpers:
  - `make api-dev`
  - `make dispatcher-dev`
  - `make web-dev`
  - `make api-oidc`
  - `make dispatcher-oidc`
  - `make web-oidc`

## Automated Tests

- Run the full monorepo checks:
  - `pnpm build`
  - `pnpm type-check`
  - `pnpm test`
- Install the local Playwright browser for headless browser regression runs:
  - `pnpm test:browser:install`
- Run the local Playwright browser regression suite:
  - `pnpm test:browser`
  - `pnpm test:browser -- --workers=4`
- Run the same browser suite headed for debugging:
  - `pnpm test:browser:headed`
- Run the local fixture-driven end-to-end path:
  - `pnpm --filter @starter/test-e2e build`
  - `make e2e`
- Targeted package checks:
  - `pnpm --filter @starter/services-api test`
  - `pnpm --filter @starter/services-dispatcher test`
  - `pnpm --filter @starter/web test`

## Local Player Testing

- Fastest path:
  - `RUN_AUTH_MODE=dev RUN_DEV_ACTOR_ID=player-aaa make dev-up`
- Test player identity:
  - actor ID: `player-aaa`
  - display name: `Local Player`
- Main URLs:
  - wizard: `http://localhost:5173/games/game-1/character/new`
  - player inbox: `http://localhost:5173/me/inbox`
  - login page: `http://localhost:5173/login`
- Seed source:
  - `scripts/local/seed.sh`

## Local GM Testing

- Fastest path:
  - `RUN_AUTH_MODE=dev RUN_DEV_ACTOR_ID=gm-zzz make dev-up`
- Test GM identity:
  - actor ID: `gm-zzz`
  - display name: `Local GM`
- Main URLs:
  - GM inbox: `http://localhost:5173/gm/game-1/inbox`
  - login page: `http://localhost:5173/login`
- Seed source:
  - `scripts/local/seed.sh`

## Real Auth Testing

- Start the stack in OIDC mode:
  - `RUN_AUTH_MODE=oidc make dev-up`
- Keycloak test users:
  - player: `player@example.com` / `player1234`
  - GM: `gm@example.com` / `gm1234`
- Login flow:
  - open `http://localhost:5173/login`
  - click `Sign In`
  - authenticate in Keycloak
- Realm/client defaults:
  - realm: `swordworld`
  - client: `swordworld-web`
- Auth source:
  - `keycloak/realm-swordworld.json`

## Debugging Guide

The local dev stack started by `make dev-up` emits web, API, dispatcher, and Docker logs into one stream. Use `commandId`, `gameId`, `characterId`, `actorId`, and `s3Key` as the main correlation keys.

- Home demo command submit: `WEB_HOME_DEMO_SUBMIT_START`, `WEB_API_POST_COMMAND_REQUEST`, `API_POST_COMMAND_REQUEST`, `API_ACTOR_RESOLVED`, `API_VALIDATE_ENVELOPE`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCHER_MESSAGE_RECEIVED`, `DISPATCH_BEGIN`, `DISPATCH_MARK_PROCESSING`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_RESULT`, `DISPATCHER_MESSAGE_DELETED`, `WEB_API_GET_COMMAND_STATUS_HIT`.
- Dev auth resolution: web API logs include `actorId` and `authMode=dev`; API logs include `API_ACTOR_RESOLVED`.
- OIDC login redirect: `WEB_LOGIN_START`.
- OIDC callback completion: `WEB_AUTH_CALLBACK_START`, `WEB_AUTH_CALLBACK_OK`.
- `CreateCharacterDraft`: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`.
- `SaveCharacterDraft`: `WEB_CHARACTER_WIZARD_SAVE_START`, `WEB_CHARACTER_WIZARD_SAVE_PAYLOAD_BUILT`, `WEB_CHARACTER_WIZARD_SAVE_ACCEPTED`, `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_CHARACTER_WIZARD_SAVE_OK`.
- `SetCharacterSubAbilities`: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`.
- `ApplyStartingPackage`: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`.
- `SpendStartingExp`: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`.
- `PurchaseStarterEquipment`: `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`.
- `SubmitCharacterForApproval`: `WEB_CHARACTER_WIZARD_EXECUTE_START`, optional auto-save logs (`WEB_CHARACTER_WIZARD_SAVE_START`, `WEB_CHARACTER_WIZARD_SAVE_ACCEPTED`, `WEB_CHARACTER_WIZARD_SAVE_OK`) when the draft is dirty, then `WEB_CHARACTER_WIZARD_STEP_SUBMIT_START`, `WEB_CHARACTER_WIZARD_STEP_SUBMIT_ACCEPTED`, `API_POST_COMMAND_REQUEST`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_CHARACTER_WIZARD_STEP_SUBMIT_OK`, `WEB_CHARACTER_WIZARD_EXECUTE_OK`.
- Command status polling: `WEB_API_GET_COMMAND_STATUS_REQUEST`, `API_GET_COMMAND_STATUS_HIT`, `WEB_API_GET_COMMAND_STATUS_HIT`, `WEB_CHARACTER_WIZARD_STATUS_POLLED`.
- Character sheet load: `WEB_CHARACTER_SHEET_LOAD_START`, `WEB_API_GET_CHARACTER_REQUEST`, `API_GET_CHARACTER_HIT`, `WEB_API_GET_CHARACTER_HIT`, `WEB_CHARACTER_SHEET_LOAD_OK`.
- Appearance upload: `WEB_CHARACTER_SHEET_UPLOAD_START`, `WEB_API_APPEARANCE_UPLOAD_URL_REQUEST`, `API_APPEARANCE_UPLOAD_URL_ISSUED`, `WEB_API_APPEARANCE_UPLOAD_URL_OK`, `WEB_CHARACTER_SHEET_UPLOAD_BINARY_OK`, `WEB_API_POST_COMMAND_REQUEST`, `API_APPEARANCE_COMMAND_AUTHORIZED`, `API_APPEARANCE_OBJECT_VERIFIED`, `API_COMMANDLOG_ACCEPTED` or `API_COMMANDLOG_IDEMPOTENT_REPLAY`, `API_ENQUEUED` or `API_ENQUEUE_SKIPPED_REPLAY`, `WEB_CHARACTER_SHEET_UPLOAD_CONFIRM_ACCEPTED`, `WEB_CHARACTER_SHEET_UPLOAD_STATUS_POLLED`, `DISPATCH_BEGIN`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_CHARACTER_SHEET_UPLOAD_OK`.
- Player inbox read: `WEB_PLAYER_INBOX_REFRESH_START`, `WEB_API_GET_PLAYER_INBOX_REQUEST`, `API_GET_PLAYER_INBOX`, `WEB_API_GET_PLAYER_INBOX_OK`, `WEB_PLAYER_INBOX_REFRESH_OK`.
- GM inbox read: `WEB_GM_INBOX_REFRESH_START`, `WEB_API_GET_GM_INBOX_REQUEST`, `API_GET_GM_INBOX`, `WEB_API_GET_GM_INBOX_OK`, `WEB_GM_INBOX_REFRESH_OK`.
- `GMReviewCharacter`: `WEB_GM_REVIEW_START`, `WEB_GM_REVIEW_ACCEPTED`, `API_POST_COMMAND_REQUEST`, `API_GM_AUTHORIZED`, `API_COMMANDLOG_ACCEPTED`, `API_ENQUEUED`, `DISPATCH_BEGIN`, `DISPATCH_HANDLER_EFFECTS`, `DISPATCH_APPLY_EFFECTS_OK`, `DISPATCHER_MESSAGE_DELETED`, `WEB_GM_REVIEW_OK`.
- Dispatcher worker loop healthy idle state: `DISPATCHER_POLL_START`, repeated `DISPATCHER_RECEIVE_BATCH`, then per command `DISPATCHER_MESSAGE_RECEIVED`, `DISPATCHER_MESSAGE_RESULT`, `DISPATCHER_MESSAGE_DELETED`.

Detailed sequence and failure-state guides:

- `docs/debugging.function-index.md`
- `docs/debugging.auth-and-home.md`
- `docs/debugging.character-creation.md`
- `docs/debugging.character-sheet-and-review.md`
- `docs/architecture-review.monorepo.md`
