import { buildApp } from "./app.js";
import type { S3Config } from "./s3.js";

const port = Number(process.env["PORT"] ?? 3399);
const databaseUrl =
  process.env["DATABASE_URL"] ?? "postgres://pagesai:pagesai@127.0.0.1:5433/pagesai";
const devToken = process.env["PAGESAI_DEV_TOKEN"]?.trim() || undefined;
const jwtSecret = process.env["HOF_SUBAPP_JWT_SECRET"]?.trim() || undefined;

function envTrim(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/**
 * Standalone: PAGESAI_S3_* or pages-ai .env.example.
 * hof-os monorepo: same keys as data-app / sister apps (S3_ENDPOINT_URL, …).
 */
function loadS3(): S3Config | undefined {
  const endpoint =
    envTrim("PAGESAI_S3_ENDPOINT") ?? envTrim("S3_ENDPOINT_URL") ?? envTrim("S3_ENDPOINT");
  const bucket =
    envTrim("PAGESAI_S3_BUCKET") ?? envTrim("S3_BUCKET_NAME") ?? envTrim("S3_BUCKET");
  const accessKeyId =
    envTrim("PAGESAI_S3_ACCESS_KEY") ?? envTrim("S3_ACCESS_KEY_ID") ?? envTrim("S3_ACCESS_KEY");
  const secretAccessKey =
    envTrim("PAGESAI_S3_SECRET_KEY") ??
    envTrim("S3_SECRET_ACCESS_KEY") ??
    envTrim("S3_SECRET_KEY");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return undefined;
  const region =
    envTrim("PAGESAI_S3_REGION") ?? envTrim("S3_REGION") ?? envTrim("AWS_DEFAULT_REGION") ?? "us-east-1";
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
  };
}

const app = await buildApp({ databaseUrl, devToken, jwtSecret, s3: loadS3() });
await app.listen({ port, host: "0.0.0.0" });
