# `hof-os` → `make dev-native SUBAPP=pagesai` exports DATABASE_URL first; optional
# root `.env` must not stomp it or clear JWT.
_HOF_OS_IMPORT_DB := $(DATABASE_URL)
_HOF_OS_IMPORT_JWT := $(HOF_SUBAPP_JWT_SECRET)
-include .env
export
ifneq ($(and $(strip $(_HOF_OS_IMPORT_JWT)),$(strip $(_HOF_OS_IMPORT_DB))),)
DATABASE_URL := $(_HOF_OS_IMPORT_DB)
HOF_SUBAPP_JWT_SECRET := $(_HOF_OS_IMPORT_JWT)
HOFOS_SUBAPP_NATIVE := 1
endif

.PHONY: help install dev dev-down

PNPM   ?= pnpm
COMPOSE := docker compose -f infra/docker/docker-compose.yml

help:
	@echo "PagesAI — local development"
	@echo ""
	@echo "  make install   $(PNPM) install (run once after clone or when deps change)"
	@echo "  make dev       Free :3399/:3400 if busy, start infra, then API + web via turbo"
	@echo "  make dev-down  Stop docker compose (data volumes kept)"
	@echo ""
	@echo "Prerequisites: Node 20+, pnpm 9+, Docker. Copy .env.example → .env if you need overrides."

install:
	$(PNPM) install

ifeq ($(HOFOS_SUBAPP_NATIVE),1)
dev: ## hofOS-attached: shared Postgres/Redis — skip local compose
	node scripts/kill-ports.mjs 3399 3400
	$(PNPM) dev
else
dev: ## Infra + turbo dev (server + web); frees stale listeners on 3399/3400 first
	$(COMPOSE) up -d
	node scripts/kill-ports.mjs 3399 3400
	$(PNPM) dev
endif

dev-down: ## Stop infra containers
	$(COMPOSE) down
