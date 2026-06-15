import { rateLimit } from "express-rate-limit";

const response = {
  success: false,
  error: "Muitas solicitações. Aguarde um minuto e tente novamente.",
};

export function createPublicCreationLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ipv6Subnet: 56,
    message: response,
  });
}

export const publicUpdateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  ipv6Subnet: 56,
  message: response,
});
