import { create } from "zustand";

export type AuthUser = {
  _id: string;
  name?: string;
  email: string;
  role?: string;
  isEmailVerified?: boolean;
};

export type AuthState = {
  user: AuthUser | null;
  email: string | null;
  userId: string | null;
  selectedRole: "student" | "teacher" | null;
  profileStatus: {
    hasProfile: boolean;
    role?: string;
    profileType?: "user" | "teacher" | null;
    profileSummary?: Record<string, unknown> | null;
  } | null;
  setUser: (user: AuthUser | null) => void;
  setEmail: (email: string | null) => void;
  setUserId: (userId: string | null) => void;
  setSelectedRole: (role: "student" | "teacher" | null) => void;
  setProfileStatus: (status: AuthState["profileStatus"]) => void;
  clearUser: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  email: null,
  userId: null,
  selectedRole: null,
  profileStatus: null,
  setUser: (user) => set({ user }),
  setEmail: (email) => set({ email }),
  setUserId: (userId) => set({ userId }),
  setSelectedRole: (selectedRole) => set({ selectedRole }),
  setProfileStatus: (profileStatus) => set({ profileStatus }),
  clearUser: () => set({ user: null, email: null, userId: null, selectedRole: null }),
}));
