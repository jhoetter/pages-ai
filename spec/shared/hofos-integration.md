# hofOS integration

## Traffic flow

```text
Browser (hof_token)
  → hofOS data-app
  → /api/pages/* proxy + sidecar JWT
  → pages-ai Fastify
```

- Browser **never** sends `hof_token` to PagesAI origin directly in production; only to hofOS.
- Sidecar JWT: signed with `HOF_SUBAPP_JWT_SECRET`, claims: `sub`, `tid` (tenant), `scopes`, `exp`.

## WebSocket

- URL: `wss://host/api/pages/ws?token=<hof_token>` (hofOS strips and re-mints upstream).

## Routes (module)

| Path                                 | Purpose           |
| ------------------------------------ | ----------------- |
| `/pages`                             | Space home / root |
| `/pages/p/:pageId`                   | Editor            |
| `/pages/p/:pageId?block=:blockId`    | Deep link         |
| `/pages/space/:spaceId`              | Space settings    |
| `/pages/db/:databaseId`              | Database          |
| `/pages/db/:databaseId?view=:viewId` | View              |
| `/pages/templates`                   | Templates         |
| `/pages/settings`                    | Product settings  |

## Shell ownership

hofOS provides: sidebar shell, auth, breadcrumbs bar, global command surfaces that **replace** standalone app chrome.

## Runtime config (web)

```ts
interface PagesAiRuntimeConfig {
  apiBase: string;
  wsBase?: string;
  workspaceId?: string;
  getAuthToken(): Promise<string>;
  hostCapabilities?: PagesAiHostCapabilities;
}
```

Set once at mount; clients read singleton (see `packages/web/src/lib/runtime-config.ts`).

## Export

- `hofos-ui.config.json` references `../hof-os/infra/sister-ui-contract.json`.
- Product key: `pagesai`.
- `pnpm run export:hofos-ui` copies `packages/web/src` → export tree per contract.

## Office-AI boundary

- Types live in `@pagesai/files`.
- Implementations: `createStandaloneFileHost()` vs `createHofOsFileHost(bridge)`.
- **No** direct `import '@officeai/react-editors'` in exported original sources for bundled editor; host passes mount callbacks through `hostCapabilities`.
