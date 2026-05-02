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

.PHONY: help install dev dev-wait dev-logs dev-stop dev-down kill-ports

PNPM   ?= pnpm
COMPOSE := docker compose -f infra/docker/docker-compose.yml
API_PORT ?= 3399
WEB_PORT ?= 3400
DEV_LOG  := .pagesai-dev.log
DEV_PID  := .pagesai-dev.pid

help:
	@echo "PagesAI — local development"
	@echo ""
	@echo "  make install   $(PNPM) install (run once after clone or when deps change)"
	@echo "  make dev       Free :$(API_PORT)/:$(WEB_PORT), start API + web, wait, then stream logs"
	@echo "  make dev-logs  Re-attach to the running dev log"
	@echo "  make dev-stop  Stop the detached dev stack"
	@echo "  make dev-down  Stop docker compose (data volumes kept)"
	@echo ""
	@echo "Prerequisites: Node 20+, pnpm 9+, Docker. Copy .env.example → .env if you need overrides."

install:
	$(PNPM) install

ifeq ($(HOFOS_SUBAPP_NATIVE),1)
dev: ## hofOS-attached: shared Postgres/Redis — skip local compose
	@$(MAKE) --no-print-directory kill-ports
else
dev: ## Infra + turbo dev (server + web); frees stale listeners on 3399/3400 first
	$(COMPOSE) up -d
	@$(MAKE) --no-print-directory kill-ports
endif
	@rm -f $(DEV_LOG) $(DEV_PID)
	@echo "→ Booting PagesAI dev stack (detached; logs → $(DEV_LOG))..."
	@( PORT=$(API_PORT) WEB_PORT=$(WEB_PORT) nohup sh -c '\
	      (cd packages/server && $(PNPM) dev) & \
	      (cd packages/web && $(PNPM) dev) & \
	      wait \
	    ' >"$(DEV_LOG)" 2>&1 & echo $$! >"$(DEV_PID)" )
	@$(MAKE) --no-print-directory dev-wait || ( \
	  echo ""; \
	  echo "❌ dev: services failed to come up healthy in 60s."; \
	  echo "─── last 80 log lines ($(DEV_LOG)) ─────────────────────────────"; \
	  tail -n 80 "$(DEV_LOG)" || true; \
	  echo "────────────────────────────────────────────────────────────────"; \
	  $(MAKE) --no-print-directory dev-stop >/dev/null 2>&1 || true; \
	  exit 1 \
	)
	@echo ""
	@echo "✅ web  http://localhost:$(WEB_PORT)"
	@echo "✅ api  http://localhost:$(API_PORT)/health"
	@echo ""
	@echo "Streaming logs. Ctrl-C / closing this terminal only stops the tail —"
	@echo "the dev stack keeps running. Re-attach: \`make dev-logs\`. Stop: \`make dev-stop\`."
	@echo ""
	@exec tail -F "$(DEV_LOG)"

dev-wait:
	@deadline=$$(($$(date +%s) + 60)); \
	api=0; web=0; \
	while [ "$$(date +%s)" -lt "$$deadline" ]; do \
	  if [ "$$api" = 0 ] && curl -fsS -o /dev/null --max-time 1 \
	      http://127.0.0.1:$(API_PORT)/health 2>/dev/null; then \
	    api=1; echo "  ✓ api  :$(API_PORT)/health"; \
	  fi; \
	  if [ "$$web" = 0 ] && curl -fsS -o /dev/null --max-time 1 \
	      http://localhost:$(WEB_PORT)/ 2>/dev/null; then \
	    web=1; echo "  ✓ web  :$(WEB_PORT)/"; \
	  fi; \
	  if [ "$$api" = 1 ] && [ "$$web" = 1 ]; then \
	    exit 0; \
	  fi; \
	  sleep 0.5; \
	done; \
	echo "  api=$$api web=$$web (1 = healthy)" >&2; \
	exit 1

dev-logs:
	@test -f "$(DEV_LOG)" || (echo "no $(DEV_LOG) — run \`make dev\` first" >&2; exit 1)
	@exec tail -F "$(DEV_LOG)"

dev-stop:
	@if [ -f "$(DEV_PID)" ]; then \
	  pid=$$(cat "$(DEV_PID)"); \
	  if [ -n "$$pid" ] && kill -0 "$$pid" 2>/dev/null; then \
	    echo "Stopping detached dev stack (pid $$pid + descendants)..."; \
	    pkill -9 -P "$$pid" 2>/dev/null || true; \
	    kill -9 "$$pid" 2>/dev/null || true; \
	  fi; \
	  rm -f "$(DEV_PID)"; \
	fi
	@$(MAKE) --no-print-directory kill-ports

kill-ports:
	@node scripts/kill-ports.mjs $(API_PORT) $(WEB_PORT)
	@pkill -9 -f "tsx.*$(CURDIR)" 2>/dev/null || true
	@pkill -9 -f "vite.*$(CURDIR)" 2>/dev/null || true
	@pkill -9 -f "turbo run dev.*$(CURDIR)" 2>/dev/null || true

dev-down: ## Stop infra containers
	$(COMPOSE) down
