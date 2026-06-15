import type { AuthenticatedRequestUser } from "../models/user.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedRequestUser;
    }
  }
}

export {};
