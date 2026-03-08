.PHONY: up down reset resources seed keycloak-import api dispatcher api-dev api-oidc dispatcher-dev dispatcher-oidc web-dev web-oidc e2e logs dev-up dev-down

up:
	docker compose -f docker-compose.local.yml up -d

down:
	docker compose -f docker-compose.local.yml down

reset: down
	rm -rf .localstack .keycloak-db
	docker compose -f docker-compose.local.yml up -d

resources:
	bash scripts/local/create-resources.sh

seed:
	bash scripts/local/seed.sh

keycloak-import:
	bash scripts/local/keycloak-import.sh

api:
	bash scripts/local/run-api.sh

dispatcher:
	bash scripts/local/run-dispatcher.sh

api-dev:
	RUN_AUTH_MODE=dev RUN_DEV_ACTOR_ID=player-aaa bash scripts/local/run-api.sh

api-oidc:
	RUN_AUTH_MODE=oidc RUN_KEYCLOAK_ISSUER=http://localhost:8080/realms/swordworld RUN_OIDC_AUDIENCE=swordworld-web bash scripts/local/run-api.sh

dispatcher-dev:
	RUN_AUTH_MODE=dev RUN_DEV_ACTOR_ID=player-aaa bash scripts/local/run-dispatcher.sh

dispatcher-oidc:
	RUN_AUTH_MODE=oidc RUN_KEYCLOAK_ISSUER=http://localhost:8080/realms/swordworld RUN_OIDC_AUDIENCE=swordworld-web bash scripts/local/run-dispatcher.sh

web-dev:
	VITE_AUTH_MODE=dev pnpm --filter @starter/web dev

web-oidc:
	VITE_AUTH_MODE=oidc VITE_OIDC_ISSUER=http://localhost:8080/realms/swordworld VITE_OIDC_CLIENT_ID=swordworld-web VITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback pnpm --filter @starter/web dev

e2e:
	bash scripts/local/e2e.sh

logs:
	docker compose -f docker-compose.local.yml logs -f --tail=200

dev-up:
	bash scripts/local/dev-up.sh

dev-down:
	bash scripts/local/dev-down.sh
