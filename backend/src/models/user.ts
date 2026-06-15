export const userRoles = ["admin", "client"] as const;
export const userPlans = ["free", "starter", "pro", "elite"] as const;

export type UserRole = (typeof userRoles)[number];
export type UserPlan = (typeof userPlans)[number];

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  plan: UserPlan;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: UserPlan;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: UserRole;
  plan: UserPlan;
}

export type AuthenticatedRequestUser = AuthTokenPayload;

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}
