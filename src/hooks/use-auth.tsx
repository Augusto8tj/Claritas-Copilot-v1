"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  updateUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user data to bypass Firebase Auth for testing if needed
const useMockUser = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';

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


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(useMockUser ? mockUser : null);
  const [loading, setLoading] = useState(!useMockUser);

  useEffect(() => {
    if (useMockUser) return;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUser = (updatedUser: User | null) => {
    setUser(updatedUser);
  };

  const value = { user, loading, updateUser };

  if (loading) {
     return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
