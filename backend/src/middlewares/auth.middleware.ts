import type { NextFunction, Request, Response } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

import { AppError } from "../models/app-error.js";
import type { UserRole } from "../models/user.js";
import { getUserById } from "../services/auth.service.js";
import { verifyToken } from "../services/token.service.js";

export async function authenticate(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorization = request.header("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError("Token de autenticação não informado.", 401);
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      throw new AppError("Token de autenticação não informado.", 401);
    }

    const payload = verifyToken(token);
    const currentUser = await getUserById(payload.id);

    request.user = {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      plan: currentUser.plan,
    };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      next(new AppError("Sua sessão expirou. Entre novamente.", 401));
      return;
    }

    if (error instanceof JsonWebTokenError) {
      next(new AppError("Token de autenticação inválido.", 401));
      return;
    }

    next(error);
  }
}

export const isAdmin = authorizeRole("admin");
export const isClient = authorizeRole("client");

function authorizeRole(role: UserRole) {
  return (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): void => {
    if (!request.user) {
      next(new AppError("Usuário não autenticado.", 401));
      return;
    }

    if (request.user.role !== role) {
      next(new AppError("Você não tem permissão para acessar esta rota.", 403));
      return;
    }

    next();
  };
}
