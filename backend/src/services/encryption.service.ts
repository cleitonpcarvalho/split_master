import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "../config/env.js";
import { AppError } from "../models/app-error.js";

const algorithm = "aes-256-gcm";
const key = createHash("sha256").update(env.encryptionKey, "utf8").digest();

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  try {
    const [version, ivValue, tagValue, encryptedValue] = payload.split(":");

    if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
      throw new Error("Formato criptografado inválido.");
    }

    const decipher = createDecipheriv(
      algorithm,
      key,
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError("Não foi possível descriptografar a credencial.", 500);
  }
}
