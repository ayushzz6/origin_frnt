import { createHash, createHmac, randomUUID } from "node:crypto";
import path from "node:path";

export type UserImagePurpose = "profile_avatar" | "memory_booth_source" | "memory_booth_card";

export type R2UploadInput = {
  userId: string;
  purpose: UserImagePurpose;
  fileName: string;
  mimeType: string;
  body: Buffer;
};

export type R2UploadResult = {
  bucket: string;
  objectKey: string;
  publicUrl: string;
  sha256: string;
  sizeBytes: number;
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Cloudflare R2 image storage.`);
  }
  return value;
}

function r2Endpoint(): string {
  const explicit =
    process.env.R2_ENDPOINT?.trim() || process.env.R2_ENDPOINT_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/u, "");
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/** Bucket used for import source files — must match Cloud Run R2_DEFAULT_BUCKET. */
export function importR2BucketName(): string {
  return process.env.R2_BUCKET_NAME?.trim() || "origin";
}

const ALLOWED_IMPORT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isAllowedImportDocumentMimeType(mimeType: string): boolean {
  return ALLOWED_IMPORT_MIME_TYPES.has(mimeType.toLowerCase());
}

export type R2BytesUploadInput = {
  objectKey: string;
  mimeType: string;
  body: Buffer;
  bucket?: string;
};

export async function uploadBytesToR2(input: R2BytesUploadInput): Promise<R2UploadResult> {
  const mimeType = input.mimeType.toLowerCase();
  if (input.body.length === 0) {
    throw new Error("Uploaded file is empty.");
  }

  const bucket = input.bucket ?? importR2BucketName();
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const endpoint = r2Endpoint();
  const payloadHash = createHash("sha256").update(input.body).digest("hex");
  const bodyHash = payloadHash;
  const { amzDate, dateStamp } = amzDateParts();
  const endpointUrl = new URL(endpoint);
  const canonicalUri = canonicalObjectPath(bucket, input.objectKey);
  const requestUrl = new URL(canonicalUri, endpointUrl);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `content-type:${mimeType}`,
    `host:${requestUrl.host}`,
    `x-amz-content-sha256:${bodyHash}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  const requestBody = input.body.buffer.slice(
    input.body.byteOffset,
    input.body.byteOffset + input.body.byteLength,
  ) as ArrayBuffer;

  const response = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": mimeType,
      "X-Amz-Content-Sha256": bodyHash,
      "X-Amz-Date": amzDate,
    },
    body: requestBody,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare R2 upload failed (${response.status}).${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }

  const publicBase = process.env.R2_PUBLIC_BASE_URL?.trim();
  return {
    bucket,
    objectKey: input.objectKey,
    publicUrl: publicBase
      ? buildR2PublicUrl(publicBase, input.objectKey)
      : `r2://${bucket}/${input.objectKey}`,
    sha256: payloadHash,
    sizeBytes: input.body.length,
  };
}

export async function uploadImportDocumentToR2(input: {
  jobId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
}): Promise<R2UploadResult> {
  const mimeType = input.mimeType.toLowerCase();
  if (!isAllowedImportDocumentMimeType(mimeType)) {
    throw new Error("Only PDF, DOCX, JPEG, PNG, or WebP files can be imported.");
  }
  const safeName = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/gu, "_") || "document";
  const objectKey = `imports/${input.jobId}/${safeName}`;
  return uploadBytesToR2({
    objectKey,
    mimeType,
    body: input.body,
  });
}

function r2PublicBaseUrl(): string {
  return requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/u, "");
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalObjectPath(bucket: string, objectKey: string): string {
  return `/${[bucket, ...objectKey.split("/")].map(encodePathSegment).join("/")}`;
}

export function buildR2PublicUrl(publicBaseUrl: string, objectKey: string): string {
  return `${publicBaseUrl.replace(/\/+$/u, "")}/${objectKey.split("/").map(encodePathSegment).join("/")}`;
}

export function isAllowedUserImageMimeType(mimeType: string): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

function extensionForImage(fileName: string, mimeType: string): string {
  const fromName = path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/gu, "");
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(fromName)) return fromName.slice(1);
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "bin";
}

export function createR2ObjectKey(input: Pick<R2UploadInput, "userId" | "purpose" | "fileName" | "mimeType">): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const userId = input.userId.replace(/[^a-zA-Z0-9_-]/gu, "_");
  const ext = extensionForImage(input.fileName, input.mimeType);
  return `${input.purpose}/${userId}/${year}/${month}/${randomUUID()}.${ext}`;
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function signingKey(secretAccessKey: string, dateStamp: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function amzDateParts(now = new Date()): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/gu, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

export async function uploadImageToR2(input: R2UploadInput): Promise<R2UploadResult> {
  const mimeType = input.mimeType.toLowerCase();
  if (!isAllowedUserImageMimeType(mimeType)) {
    throw new Error("Only JPEG, PNG, WebP, or GIF images can be uploaded.");
  }
  if (input.body.length === 0) {
    throw new Error("Uploaded image is empty.");
  }

  const bucket = requiredEnv("R2_BUCKET_NAME");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const endpoint = r2Endpoint();
  const objectKey = createR2ObjectKey(input);
  const payloadHash = createHash("sha256").update(input.body).digest("hex");
  const bodyHash = payloadHash;
  const { amzDate, dateStamp } = amzDateParts();
  const endpointUrl = new URL(endpoint);
  const canonicalUri = canonicalObjectPath(bucket, objectKey);
  const requestUrl = new URL(canonicalUri, endpointUrl);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `content-type:${mimeType}`,
    `host:${requestUrl.host}`,
    `x-amz-content-sha256:${bodyHash}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  const requestBody = input.body.buffer.slice(
    input.body.byteOffset,
    input.body.byteOffset + input.body.byteLength,
  ) as ArrayBuffer;

  const response = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": mimeType,
      "X-Amz-Content-Sha256": bodyHash,
      "X-Amz-Date": amzDate,
    },
    body: requestBody,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare R2 upload failed (${response.status}).${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }

  return {
    bucket,
    objectKey,
    publicUrl: buildR2PublicUrl(r2PublicBaseUrl(), objectKey),
    sha256: payloadHash,
    sizeBytes: input.body.length,
  };
}
