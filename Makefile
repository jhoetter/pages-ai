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

dev: ## Infra + turbo dev (server + web); frees stale listeners on 3399/3400 first
	$(COMPOSE) up -d
	node scripts/kill-ports.mjs 3399 3400
	$(PNPM) dev

dev-down: ## Stop infra containers
	$(COMPOSE) down
