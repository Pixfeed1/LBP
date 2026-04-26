export type UserRole = "admin" | "manager" | "collaborator";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: "Y" | "N";
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  by_role: Record<string, number>;
}

export interface UserCreatePayload {
  email: string;
  name: string;
  role: UserRole;
  password?: string;
}

export interface UserCreateResponse {
  user: User;
  temp_password: string | null;
  password_generated: boolean;
}

export interface UserUpdatePayload {
  name?: string;
  role?: UserRole;
  is_active?: "Y" | "N";
}
