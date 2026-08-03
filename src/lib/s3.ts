import { createHash, createHmac } from "node:crypto";

/**
 * The three S3 calls the backup system needs, signed with SigV4 by hand.
 *
 * Works against any S3-compatible endpoint — Cloudflare R2, AWS S3,
 * Backblaze B2. Hand-rolled rather than pulling in @aws-sdk/client-s3,
 * which is a large dependency to add to a serverless function that only
 * ever puts, gets and lists an object.
 */

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Reads the backup target from the environment, or null when it isn't
 * configured — the caller decides whether that's an error or a skip. */
export function s3ConfigFromEnv(): S3Config | null {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    // R2 ignores the region but still requires one in the signature.
    region: process.env.BACKUP_S3_REGION || "auto",
    accessKeyId,
    secretAccessKey,
  };
}

function sha256Hex(payload: Buffer | string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/** Each path segment is encoded, but the slashes between them are not. */
function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

function sign(
  config: S3Config,
  method: string,
  key: string,
  body: Buffer | null,
  query: Record<string, string> = {},
  extraHeaders: Record<string, string> = {}
): SignedRequest {
  const url = new URL(`${config.endpoint}/${config.bucket}${key ? `/${encodeKey(key)}` : ""}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body ?? "");

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };

  const sortedHeaderNames = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const canonicalHeaders = sortedHeaderNames
    .map((name) => {
      const value = Object.entries(headers).find(
        ([k]) => k.toLowerCase() === name
      )![1];
      return `${name}:${String(value).trim()}\n`;
    })
    .join("");
  const signedHeaders = sortedHeaderNames.join(";");

  // Query parameters must be sorted by key for the canonical request.
  const canonicalQuery = Array.from(url.searchParams.keys())
    .sort()
    .map(
      (k) => `${encodeURIComponent(k)}=${encodeURIComponent(url.searchParams.get(k) ?? "")}`
    )
    .join("&");

  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: url.toString(), headers };
}

export async function s3PutObject(
  config: S3Config,
  key: string,
  body: Buffer,
  contentType = "application/octet-stream"
): Promise<void> {
  const { url, headers } = sign(config, "PUT", key, body, {}, {
    "content-type": contentType,
  });

  const response = await fetch(url, { method: "PUT", headers, body: new Uint8Array(body) });

  if (!response.ok) {
    throw new Error(
      `S3 PUT ${key} failed: ${response.status} ${await response.text().catch(() => "")}`
    );
  }
}

export async function s3GetObject(config: S3Config, key: string): Promise<Buffer> {
  const { url, headers } = sign(config, "GET", key, null);
  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    throw new Error(
      `S3 GET ${key} failed: ${response.status} ${await response.text().catch(() => "")}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: string;
}

/** Lists up to 1000 keys under a prefix, newest last (S3 returns
 * lexicographic order, and the keys are date-stamped). */
export async function s3ListObjects(
  config: S3Config,
  prefix: string
): Promise<S3Object[]> {
  const { url, headers } = sign(config, "GET", "", null, {
    "list-type": "2",
    prefix,
  });

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(
      `S3 LIST ${prefix} failed: ${response.status} ${await response.text().catch(() => "")}`
    );
  }

  const xml = await response.text();
  const objects: S3Object[] = [];
  const contentsPattern = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match: RegExpExecArray | null;

  while ((match = contentsPattern.exec(xml)) !== null) {
    const block = match[1];
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1];
    if (!key) continue;
    objects.push({
      key,
      size: Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] ?? 0),
      lastModified: /<LastModified>([\s\S]*?)<\/LastModified>/.exec(block)?.[1] ?? "",
    });
  }

  return objects;
}
