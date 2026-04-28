import { buildApp } from "./app.js";
import type { S3Config } from "./s3.js";

const port = Number(process.env["PORT"] ?? 3399);
const databaseUrl =
  process.env["DATABASE_URL"] ?? "postgres://pagesai:pagesai@127.0.0.1:5433/pagesai";
const devToken = process.env["PAGESAI_DEV_TOKEN"]?.trim() || undefined;
const jwtSecret = process.env["HOF_SUBAPP_JWT_SECRET"]?.trim() || undefined;

function loadS3(): S3Config | undefined {
  const endpoint = process.env["PAGESAI_S3_ENDPOINT"]?.trim();
  const bucket = process.env["PAGESAI_S3_BUCKET"]?.trim();
  const accessKeyId = process.env["PAGESAI_S3_ACCESS_KEY"]?.trim();
  const secretAccessKey = process.env["PAGESAI_S3_SECRET_KEY"]?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return undefined;
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env["PAGESAI_S3_REGION"]?.trim() || "us-east-1",
  };
}

const app = await buildApp({ databaseUrl, devToken, jwtSecret, s3: loadS3() });
await app.listen({ port, host: "0.0.0.0" });
