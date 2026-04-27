import { buildApp } from "./app.js";

const port = Number(process.env["PORT"] ?? 3399);
const databaseUrl =
  process.env["DATABASE_URL"] ?? "postgres://pagesai:pagesai@127.0.0.1:5433/pagesai";
const devToken = process.env["PAGESAI_DEV_TOKEN"]?.trim() || undefined;
const jwtSecret = process.env["HOF_SUBAPP_JWT_SECRET"]?.trim() || undefined;

const app = await buildApp({ databaseUrl, devToken, jwtSecret });
await app.listen({ port, host: "0.0.0.0" });
