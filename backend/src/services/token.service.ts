import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";
import type { AuthTokenPayload } from "../models/user.js";

export function createToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    issuer: "split-master-api",
    audience: "split-master-web",
    subject: payload.id,
  };

  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, env.jwtSecret, {
    issuer: "split-master-api",
    audience: "split-master-web",
  });

  if (typeof payload === "string") {
    throw new Error("Token JWT inválido.");
  }

  return {
    id: String(payload.id),
    email: String(payload.email),
    role: payload.role as AuthTokenPayload["role"],
    plan: payload.plan as AuthTokenPayload["plan"],
  };
}
