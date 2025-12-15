
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const DERIV_API_TOKEN_KEY = 'derivApiToken';

interface DerivApiContextType {
  apiToken: string | null;
  isConnected: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
}

const DerivApiContext = createContext<DerivApiContextType | undefined>(undefined);

export function DerivApiProvider({ children }: { children: ReactNode }) {
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(DERIV_API_TOKEN_KEY);
      if (storedToken) {
        setApiToken(storedToken);
      }
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    setLoading(false);
  }, []);

  const connect = (token: string) => {
    try {
      localStorage.setItem(DERIV_API_TOKEN_KEY, token);
      setApiToken(token);
    } catch (error) {
      console.error("Failed to save token to localStorage:", error);
    }
  };

  const disconnect = () => {
    try {
      localStorage.removeItem(DERIV_API_TOKEN_KEY);
      setApiToken(null);
    } catch (error) {
        console.error("Failed to remove token from localStorage:", error);
    }
  };

  const value = {
    apiToken,
    isConnected: !!apiToken,
    connect,
    disconnect,
  };

  if (loading) {
    return null;
  }

  return (
    <DerivApiContext.Provider value={value}>
      {children}
    </DerivApiContext.Provider>
  );
}

export function useDerivApi() {
  const context = useContext(DerivApiContext);
  if (context === undefined) {
    throw new Error('useDerivApi must be used within a DerivApiProvider');
  }
  return context;
}
