"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { Loader2 } from "lucide-react";

// Mock user data to bypass Firebase Auth for testing
const mockUser: User = {
  uid: "mock-user-123",
  displayName: "Usuário de Teste",
  email: "teste@exemplo.com",
  photoURL: "https://placehold.co/100x100.png",
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  providerId: "password",
  refreshToken: "mock-token",
  tenantId: null,
  delete: async () => undefined,
  getIdToken: async () => "mock-id-token",
  getIdTokenResult: async () => ({
    token: "mock-id-token",
    expirationTime: new Date().toISOString(),
    authTime: new Date().toISOString(),
    issuedAtTime: new Date().toISOString(),
    signInProvider: null,
    signInSecondFactor: null,
    claims: {},
  }),
  reload: async () => undefined,
  toJSON: () => ({}),
};


type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always return the mock user and set loading to false
  const value = { user: mockUser, loading: false };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
