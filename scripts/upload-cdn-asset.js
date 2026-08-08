#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

const DEFAULT_ENDPOINT = "https://kr.object.ncloudstorage.com";
const DEFAULT_REGION = "kr-standard";
const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";
const SERVICE = "s3";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }

      const separator = trimmed.indexOf("=");
      if (separator < 0) {
        return acc;
      }

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] == null) {
        acc[key] = value;
      }

      return acc;
    }, {});
}

function envValue(env, names) {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function requireValue(env, names, label) {
  const value = envValue(env, names);
  if (!value) {
    throw new Error(`${label} is required. Set ${names.join(" or ")}.`);
  }

  return value;
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".webp": "image/webp",
  };

  return types[ext] || "application/octet-stream";
}

function hashHex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value).digest(encoding);
}

function isoAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(date) {
  return isoAmzDate(date).slice(0, 8);
}

function encodePath(value) {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function sanitizeFileStem(filePath) {
  const ext = path.extname(filePath);
  const stem = path.basename(filePath, ext);
  return stem
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "asset";
}

function defaultObjectKey(filePath, body, prefix) {
  const ext = path.extname(filePath).toLowerCase();
  const stem = sanitizeFileStem(filePath);
  const digest = crypto.createHash("sha1").update(body).digest("hex").slice(0, 10);
  const fileName = `${stem}-${digest}${ext}`;
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");

  return cleanPrefix ? `${cleanPrefix}/${fileName}` : fileName;
}

function collectFiles(sourcePath) {
  const stat = fs.statSync(sourcePath);
  if (stat.isFile()) {
    return [sourcePath];
  }

  if (!stat.isDirectory()) {
    throw new Error(`Source must be a file or directory: ${sourcePath}`);
  }

  const files = [];
  const stack = [sourcePath];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files.sort();
}

function buildPublicUrl(baseUrl, key) {
  const cleanBase = baseUrl.replace(/\/+$/g, "");
  const cleanKey = key.replace(/^\/+/g, "");
  return `${cleanBase}/${encodePath(cleanKey)}`;
}

function signRequest({
  accessKeyId,
  secretAccessKey,
  region,
  method,
  host,
  canonicalUri,
  headers,
  payloadHash,
  now,
}) {
  const stamp = dateStamp(now);
  const amzDate = isoAmzDate(now);
  const credentialScope = `${stamp}/${region}/${SERVICE}/aws4_request`;
  const signedHeaderNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();

  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${String(headers[name]).trim().replace(/\s+/g, " ")}`)
    .join("\n");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaderNames.join(";"),
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join("\n");

  const dateKey = hmac(`AWS4${secretAccessKey}`, stamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, SERVICE);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");

  return {
    amzDate,
    authorization: [
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaderNames.join(";")}`,
      `Signature=${signature}`,
    ].join(", "),
  };
}

function putObject({ endpoint, bucket, key, body, contentType, config }) {
  return new Promise((resolve, reject) => {
    const endpointUrl = new URL(endpoint);
    const now = new Date();
    const canonicalUri = `/${bucket}/${encodePath(key)}`;
    const payloadHash = hashHex(body);
    const headers = {
      "cache-control": config.cacheControl,
      "content-length": String(body.length),
      "content-type": contentType,
      host: endpointUrl.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": isoAmzDate(now),
    };

    if (config.acl) {
      headers["x-amz-acl"] = config.acl;
    }

    const signature = signRequest({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      method: "PUT",
      host: endpointUrl.host,
      canonicalUri,
      headers,
      payloadHash,
      now,
    });

    headers.authorization = signature.authorization;
    headers["x-amz-date"] = signature.amzDate;

    const req = https.request(
      {
        method: "PUT",
        hostname: endpointUrl.hostname,
        port: endpointUrl.port || 443,
        path: canonicalUri,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: text });
            return;
          }

          reject(new Error(`Upload failed with ${res.statusCode}: ${text}`));
        });
      }
    );

    req.on("error", reject);
    req.end(body);
  });
}

async function main() {
  const env = {
    ...readEnvFile(path.resolve(process.cwd(), ".env.cdn")),
    ...process.env,
  };
  const args = process.argv.slice(2);
  const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
  const fileArg = positionalArgs[0];
  const keyArg = positionalArgs[1];
  const json = args.includes("--json");
  const dryRun = args.includes("--dry-run");

  if (!fileArg) {
    throw new Error("Usage: npm run cdn:upload -- <file-or-directory> [object-key-or-prefix] [--json] [--dry-run]");
  }

  const sourcePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source not found: ${sourcePath}`);
  }

  const config = {
    accessKeyId: requireValue(env, ["CDN_ACCESS_KEY_ID", "NCP_ACCESS_KEY_ID", "NCP_ACCESS_KEY"], "Access key"),
    secretAccessKey: requireValue(
      env,
      ["CDN_SECRET_ACCESS_KEY", "NCP_SECRET_ACCESS_KEY", "NCP_SECRET_KEY"],
      "Secret key"
    ),
    bucket: requireValue(env, ["CDN_BUCKET", "NCP_OBJECT_BUCKET"], "Bucket"),
    publicBaseUrl: requireValue(env, ["CDN_PUBLIC_BASE_URL", "CDN_BASE_URL"], "Public CDN base URL"),
    endpoint: envValue(env, ["CDN_ENDPOINT", "NCP_OBJECT_ENDPOINT"]) || DEFAULT_ENDPOINT,
    region: envValue(env, ["CDN_REGION", "NCP_OBJECT_REGION"]) || DEFAULT_REGION,
    prefix: envValue(env, ["CDN_PREFIX"]),
    cacheControl: envValue(env, ["CDN_CACHE_CONTROL"]) || DEFAULT_CACHE_CONTROL,
    acl: envValue(env, ["CDN_ACL"]),
  };

  const sourceStat = fs.statSync(sourcePath);
  const sourceFiles = collectFiles(sourcePath);
  const results = [];

  for (const filePath of sourceFiles) {
    const body = fs.readFileSync(filePath);
    const objectKey = sourceStat.isDirectory()
      ? defaultObjectKey(filePath, body, keyArg || config.prefix)
      : keyArg || defaultObjectKey(filePath, body, config.prefix);
    const contentType = guessContentType(filePath);
    const publicUrl = buildPublicUrl(config.publicBaseUrl, objectKey);
    const result = {
      bucket: config.bucket,
      contentType,
      endpoint: config.endpoint,
      file: path.relative(process.cwd(), filePath),
      key: objectKey,
      publicUrl,
      size: body.length,
    };

    if (!dryRun) {
      await putObject({
        endpoint: config.endpoint,
        bucket: config.bucket,
        key: objectKey,
        body,
        contentType,
        config,
      });
    }

    results.push(result);
  }

  if (json) {
    console.log(JSON.stringify({ dryRun, files: results }, null, 2));
    return;
  }

  console.log(dryRun ? "CDN upload dry run" : "CDN upload complete");
  results.forEach((result) => {
    console.log(`${result.file}`);
    console.log(`key: ${result.key}`);
    console.log(`url: ${result.publicUrl}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
