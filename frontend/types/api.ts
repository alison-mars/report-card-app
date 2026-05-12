import type { AuthUser } from "@/store/auth";

export type RegisterResponse = {
  success: boolean;
  message: string;
  userId?: string;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
  role?: string;
  requiresVerification?: boolean;
  userId?: string;
};

export type VerifyOtpResponse = {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
  role?: string;
  isProfileComplete?: boolean;
};

export type ProfileStatusResponse = {
  success: boolean;
  hasProfile: boolean;
  role: string;
  profileType: "user" | "teacher" | null;
  profileSummary?: Record<string, unknown> | null;
};

export type CompleteProfileResponse = {
  success: boolean;
  message: string;
  profileSummary?: Record<string, unknown>;
};
