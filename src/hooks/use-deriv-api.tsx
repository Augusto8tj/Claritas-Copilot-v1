
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { getAccountBalance } from '@/services/deriv-api-service';

const DERIV_DEMO_TOKEN_KEY = 'derivDemoApiToken';
const DERIV_REAL_TOKEN_KEY = 'derivRealApiToken';
const DERIV_ACCOUNT_TYPE_KEY = 'derivAccountType';

export type AccountType = 'demo' | 'real';

interface AccountBalance {
  balance: number | null;
  currency: string | null;
  loading: boolean;
}

interface DerivApiContextType {
  demoToken: string | null;
  realToken: string | null;
  activeToken: string | null;
  accountType: AccountType;
  isConnected: boolean;
  accountBalance: AccountBalance;
  setAccountType: (type: AccountType) => void;
  setTokens: (tokens: { demo?: string; real?: string }) => void;
  disconnect: (type: AccountType) => void;
  refreshBalance: () => void;
}

const DerivApiContext = createContext<DerivApiContextType | undefined>(undefined);

export function DerivApiProvider({ children }: { children: ReactNode }) {
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [realToken, setRealToken] = useState<string | null>(null);
  const [accountType, setAccountTypeState] = useState<AccountType>('demo');
  const [accountBalance, setAccountBalance] = useState<AccountBalance>({ balance: null, currency: null, loading: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedDemoToken = localStorage.getItem(DERIV_DEMO_TOKEN_KEY);
      const storedRealToken = localStorage.getItem(DERIV_REAL_TOKEN_KEY);
      const storedAccountType = localStorage.getItem(DERIV_ACCOUNT_TYPE_KEY) as AccountType | null;
      
      if (storedDemoToken) setDemoToken(storedDemoToken);
      if (storedRealToken) setRealToken(storedRealToken);
      if (storedAccountType) setAccountTypeState(storedAccountType);

    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    setLoading(false);
  }, []);

  const setAccountType = (type: AccountType) => {
    try {
        localStorage.setItem(DERIV_ACCOUNT_TYPE_KEY, type);
        setAccountTypeState(type);
    } catch (error) {
        console.error("Failed to save account type to localStorage:", error);
    }
  }

  const setTokens = (tokens: { demo?: string; real?: string }) => {
    try {
      if (tokens.demo) {
        localStorage.setItem(DERIV_DEMO_TOKEN_KEY, tokens.demo);
        setDemoToken(tokens.demo);
      }
      if (tokens.real) {
        localStorage.setItem(DERIV_REAL_TOKEN_KEY, tokens.real);
        setRealToken(tokens.real);
      }
    } catch (error) {
      console.error("Failed to save token to localStorage:", error);
    }
  };

  const disconnect = (type: AccountType) => {
    try {
      if (type === 'demo') {
        localStorage.removeItem(DERIV_DEMO_TOKEN_KEY);
        setDemoToken(null);
      } else {
        localStorage.removeItem(DERIV_REAL_TOKEN_KEY);
        setRealToken(null);
      }
    } catch (error) {
        console.error("Failed to remove token from localStorage:", error);
    }
  };
  
  const activeToken = accountType === 'demo' ? demoToken : realToken;

  const fetchBalance = useCallback(async () => {
    if (!activeToken) {
      setAccountBalance({ balance: null, currency: null, loading: false });
      return;
    }
    setAccountBalance(prev => ({...prev, loading: true}));
    try {
      const { balance, currency } = await getAccountBalance(activeToken);
      setAccountBalance({ balance, currency, loading: false });
    } catch (error) {
      console.error("Failed to fetch account balance:", error);
      setAccountBalance({ balance: null, currency: null, loading: false });
    }
  }, [activeToken]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const contextValue = {
    demoToken,
    realToken,
    activeToken,
    accountType,
    isConnected: !!activeToken,
    setAccountType,
    setTokens,
    disconnect,
    accountBalance,
    refreshBalance: fetchBalance
  };

  if (loading) {
    return null;
  }
  
  return (
    <DerivApiContext.Provider value={contextValue}>
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
