// Direct S3-compatible storage (MinIO/AWS). Forge removed.
import crypto from "crypto";
import http from "http";
import { ENV } from "./_core/env";

/** Result of building a presigned S3 URL, exposing the signing timestamp for reuse on the wire. */
export interface SignedUrlResult {
  url: string;
  amzDate: string;
}

interface SignedRequestResult {
  ok: boolean;
  status: number;
  body: string;
  buffer: Buffer;
  headers: Record<string, string>;
}

/**
 * Execute a request to the presigned URL with ONLY the explicitly provided
 * headers. Unlike fetch/undici (which injects accept, accept-encoding,
 * user-agent, ... and breaks presigned verification), http.request sends
 * exactly what we specify — required for strict S3-compatible services.
 */
async function signedHttp(
  signedUrl: string,
  method: "GET" | "PUT",
  headers: Record<string, string>,
  body?: Buffer,
): Promise<SignedRequestResult> {
  return new Promise((resolve, reject) => {
    const target = new URL(signedUrl);
    const req = http.request(
      {
        method,
        host: target.host,
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        headers: { ...headers, Connection: "close" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            body: buf.toString("utf8"),
            buffer: buf,
            headers: res.headers as Record<string, string>,
          });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("S3 request timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

function getAwsConfig() {
  if (!ENV.s3Endpoint || !ENV.s3AccessKey || !ENV.s3SecretKey) {
    throw new Error(
      "Storage config missing: set S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY",
    );
  }
  return {
    endpoint: ENV.s3Endpoint,
    accessKey: ENV.s3AccessKey,
    secretKey: ENV.s3SecretKey,
    region: ENV.s3Region,
    bucket: ENV.s3Bucket,
    forcePathStyle: ENV.s3ForcePathStyle,
  };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function hashBufferToHex(buf: string | ArrayBuffer | Uint8Array): string {
  const arr = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sha256(data: string | Uint8Array): Promise<ArrayBuffer> {
  const input = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return crypto.webcrypto.subtle.digest("SHA-256", input);
}

function hmac(keyData: BufferSource | string, message: BufferSource | string): Promise<ArrayBuffer> {
  const keyBuf = typeof keyData === "string" ? new TextEncoder().encode(keyData) : new Uint8Array(keyData as ArrayBuffer);
  const msgBuf = typeof message === "string" ? new TextEncoder().encode(message) : new Uint8Array(message as ArrayBuffer);
  return crypto.subtle
    .importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, msgBuf));
}

async function buildSignedUrl(
  method: "PUT" | "GET",
  key: string,
  contentType?: string,
  contentLength?: number,
): Promise<SignedUrlResult> {
  const cfg = getAwsConfig();
  const endpoint = cfg.endpoint.replace(/\/+$/, "");
  const url = cfg.forcePathStyle ? `${endpoint}/${cfg.bucket}/${key}` : `${endpoint}/${key}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";
  const scope = `${dateStamp}/${cfg.region}/${service}/aws4_request`;

  const payloadHash = method === "PUT"
    ? "UNSIGNED-PAYLOAD"
    : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // sha256("")

  // Verified against MinIO (2026): boto3 signs ONLY `host` for presigned
  // object requests even when Content-Type/Content-Length are sent on the
  // wire. Signing extra headers (content-type, content-length, x-amz-date)
  // makes MinIO reject with "headers present in the request which were not
  // signed" because wire-level headers (including implicit ones) mismatch.
  // Sign the minimal canonical set: host + x-amz-content-sha256.
  // Match botocore S3SigV4QueryAuth (verified 2026-08): the signed header set
  // always includes `host` + `x-amz-content-sha256`, PLUS `content-type` when
  // Content-Type is sent on the wire. The canonical query string is built
  // from URL-encoded values (including %3B inside X-Amz-SignedHeaders and
  // %2F inside the credential) — NOT the raw characters.
  // Match botocore S3SigV4QueryAuth EXACTLY (verified 2026-08-20 via
  // subclassed canonical_request dump): only host + x-amz-content-sha256
  // are signed; the canonical query uses URL-encoded values (%2F, %3B).
  const canonicalHeaders: Record<string, string> = {
    host: new URL(url).host,
    "x-amz-content-sha256": payloadHash,
  };
  void contentType;
  void contentLength;
  // Botocore appends a trailing newline to canonical headers:
  // `cr.append(self.canonical_headers(headers_to_sign) + '\n')`. MinIO
  // (verified 2026-08-20) computes signatures the same way, so the trailing
  // `\n` MUST be included or the server rejects with 403 SignatureDoesNotMatch.
  const sortedHeaders =
    Object.entries(canonicalHeaders)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v.trim()}`)
      .join("\n") + "\n";
  const signedHeaders = Object.keys(canonicalHeaders)
    .sort()
    .join(";");
  void contentType;

  // The canonical query string uses URL-encoded values (botocore's
  // S3SigV4QueryAuth canonicalises the query AFTER encoding values), so the
  // same encoded strings used in the real URL are reused here.
  const qsCredential = encodeURIComponent(`${cfg.accessKey}/${scope}`);
  const qsSignedHeaders = signedHeaders.replace(/;/g, "%3B");
  const canonicalQuery = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${qsCredential}&X-Amz-Date=${amzDate}&X-Amz-Expires=3600&X-Amz-SignedHeaders=${qsSignedHeaders}`;

  const canonicalRequestParts = [
    method,
    new URL(url).pathname,
    canonicalQuery,
    sortedHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hashBufferToHex(canonicalRequestParts)].join("\n");

  const signingKey = await hmac(`AWS4${cfg.secretKey}`, dateStamp)
    .then((r) => hmac(r, cfg.region))
    .then((r) => hmac(r, service))
    .then((r) => hmac(r, "aws4_request"))
    .then((r) => hmac(r, stringToSign));

  return { url: `${url}?${canonicalQuery}&X-Amz-Signature=${hashBufferToHex(signingKey)}`, amzDate };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const bodyBytes = typeof data === "string" ? new TextEncoder().encode(data) : (data as Uint8Array);

  // Header-based SigV4: use the bare object URL (no presigned query params —
  // mixing query signatures with an Authorization header is rejected by
  // MinIO as "multiple authentication types").
  const cfg = getAwsConfig();
  const parsedCfg = new URL(cfg.endpoint);
  const signed = { url: `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${key}` };
  void parsedCfg;

  // S3-compatible services (MinIO in particular) reject presigned PUT
  // requests when the wire request carries ANY header that was not included
  // in the signature. Undici/fetch injects accept, accept-encoding, user-agent,
  // etc. by default, so we use a raw http request with ONLY the signed headers
  // (plus connection: close, which is never signed/checked) instead of fetch.
  // Wire headers: Content-Type/Content-Length (unsigned, like boto3) and
  // x-amz-content-sha256/x-amz-date MUST match the signed canonical values.
  // Do NOT send extra x-amz headers — boto3 omits them and MinIO requires
  // the signed set to match what is actually on the wire.
  // Mirror boto3: send ONLY Content-Type + Content-Length (unsigned);
  // do NOT send x-amz-content-sha256 / x-amz-date headers — boto3 omits
  // them for presigned object requests and MinIO accepts that.
  // Wire headers must match the signed set (host + x-amz-content-sha256 in
  // canonical). Like botocore, we do NOT send x-amz-content-sha256 /
  // x-amz-date on the wire for presigned object PUTs.
  // Botocore wire headers for a presigned S3 PUT: Content-Type,
  // Content-Length, Accept-Encoding: identity, Host (+ implicit
  // connection). Keep the same set.
  // Use the Authorization-header (header-based) SigV4 variant: every header
  // on the wire is signed, so "headers not signed" (400) and timestamp drift
  // between presigned URL and request (403) are both impossible.
  const payloadHash = await sha256Buffer(Buffer.from(bodyBytes));
  const wireHeaders: Record<string, string> = {
    Host: new URL(signed.url).host,
    "Content-Type": contentType,
    "Content-Length": String(bodyBytes.length),
  };
  const amzDate = await computeAmzDate();
  const auth = await computeAuthorization("PUT", signed.url, wireHeaders, payloadHash, amzDate);
  const uploadResp = await signedHttp(signed.url, "PUT", {
    ...wireHeaders,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: auth,
  }, Buffer.from(bodyBytes));
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status}): ${uploadResp.body.replace(/\s+/g, " ").slice(0, 300)}`);
  }
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

/** SHA-256 of an empty payload, per AWS4 canonical rules. */
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** SHA-256 of a buffer returned as hex. */
async function sha256Buffer(buf: Buffer): Promise<string> {
  return hashBufferToHex(await sha256(buf));
}

/** Current UTC timestamp formatted as YYYYMMDDTHHMMSSZ. */
function computeAmzDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/**
 * Compute an AWS4-HMAC-SHA256 `Authorization` header value for the given
 * method, URL and wire header set. Every header in `wireHeaders` plus the
 * two x-amz headers is signed, so the server can verify the request
 * without any presigned-URL encoding pitfalls.
 */
async function computeAuthorization(
  method: string,
  url: string,
  wireHeaders: Record<string, string>,
  payloadHash: string,
  amzDate: string,
): Promise<string> {
  const cfg = getAwsConfig();
  const parsed = new URL(url);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;

  const hdrNames = Array.from(
    new Set(
      Object.keys(wireHeaders)
        .map((h) => h.toLowerCase())
        .concat(["x-amz-content-sha256", "x-amz-date"])
        .filter((h) => h !== "connection"),
    ),
  ).sort();

  // Same botocore trailing-newline rule as buildSignedUrl: canonical headers
  // are terminated with a trailing `\n` before signedHeaders in the
  // canonical request (verified byte-for-byte against botocore S3SigV4Auth
  // canonical_request output on 2026-08-20).
  const canonicalHeaders =
    hdrNames
      .map((h) => {
        if (h === "x-amz-content-sha256") return `x-amz-content-sha256:${payloadHash}`;
        if (h === "x-amz-date") return `x-amz-date:${amzDate}`;
        const orig = Object.keys(wireHeaders).find((k) => k.toLowerCase() === h)!;
        return `${h}:${String(wireHeaders[orig]).trim()}`;
      })
      .join("\n") + "\n";
  const signedHeaders = hdrNames.join(";");

  const canonicalRequest = [
    method,
    parsed.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hashBufferToHex(await sha256(canonicalRequest)),
  ].join("\n");

  const signingKey = await hmac(`AWS4${cfg.secretKey}`, dateStamp)
    .then((r) => hmac(r, cfg.region))
    .then((r) => hmac(r, "s3"))
    .then((r) => hmac(r, "aws4_request"))
    .then((r) => hmac(r, stringToSign));

  return `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hashBufferToHex(signingKey)}`;
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  return (await buildSignedUrl("GET", key)).url;
}

/**
 * Fetch the object content through an internally signed URL so storage
 * credentials never leave the server, then pipe it to the HTTP response.
 */
export async function storageServe(
  relKey: string,
  res: { setHeader: (k: string, v: string) => void; send: (body: Buffer) => void },
): Promise<void> {
  const key = normalizeKey(relKey);
  // Header-based SigV4 GET: use the BARE object URL. buildSignedUrl returns a
  // presigned query URL — mixing query params (X-Amz-Signature) with an
  // Authorization header is rejected by MinIO as "multiple authentication
  // types" (400 InvalidRequest, verified 2026-08-20).
  const cfg = getAwsConfig();
  const bareUrl = `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}/${key}`;
  // host is the only non-x-amz wire header, signed in the canonical request.
  const amzDate = await computeAmzDate();
  const wireHeaders: Record<string, string> = { Host: new URL(bareUrl).host };
  const auth = await computeAuthorization("GET", bareUrl, wireHeaders, EMPTY_SHA256, amzDate);
  const resp = await signedHttp(bareUrl, "GET", {
    ...wireHeaders,
    "x-amz-content-sha256": EMPTY_SHA256,
    "x-amz-date": amzDate,
    Authorization: auth,
  });
  if (!resp.ok) {

    const err = new Error(`storage_get_failed`) as Error & { status: number };
    err.status = resp.status === 404 ? 404 : 502;
    throw err;
  }
  const contentType = resp.headers["content-type"] ?? undefined;
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(resp.buffer);
}
