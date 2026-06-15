export const authTokenStorageKey = "split_master_auth_token";

export type UserRole = "admin" | "client";
export type UserPlan = "free" | "starter" | "pro" | "elite";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: UserPlan;
  isActive: boolean;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(authTokenStorageKey);
}

export function storeToken(token: string): void {
  window.localStorage.setItem(authTokenStorageKey, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(authTokenStorageKey);
}
