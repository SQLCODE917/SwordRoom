.PHONY: up down reset resources seed keycloak-import api dispatcher e2e logs

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

e2e:
	bash scripts/local/e2e.sh

logs:
	docker compose -f docker-compose.local.yml logs -f --tail=200
