
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import { getAccountBalance, requestProposal, buyContract, type TradeResult } from '@/services/deriv-api-service';

const DERIV_DEMO_TOKEN_KEY = 'derivDemoApiToken';
const DERIV_REAL_TOKEN_KEY = 'derivRealApiToken';
const DERIV_ACCOUNT_TYPE_KEY = 'derivAccountType';
const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089";

export type AccountType = 'demo' | 'real';

interface AccountBalance {
  balance: number | null;
  currency: string | null;
  loading: boolean;
}

interface DerivApiContextType {
  ws: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  demoToken: string | null;
  realToken: string | null;
  activeToken: string | null;
  accountType: AccountType;
  accountBalance: AccountBalance;
  setAccountType: (type: AccountType) => void;
  setTokens: (tokens: { demo?: string; real?: string }) => void;
  disconnect: (type: AccountType) => void;
  refreshBalance: () => void;
  executeTrade: (contractType: string, quantity: number, symbol: string) => Promise<TradeResult>;
}

const DerivApiContext = createContext<DerivApiContextType | undefined>(undefined);

export function DerivApiProvider({ children }: { children: ReactNode }) {
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [realToken, setRealToken] = useState<string | null>(null);
  const [accountType, setAccountTypeState] = useState<AccountType>('demo');
  const [accountBalance, setAccountBalance] = useState<AccountBalance>({ balance: null, currency: null, loading: true });
  const [isLoading, setIsLoading] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const proposalPromisesRef = useRef<Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>>(new Map());


  // Load tokens from localStorage on initial render
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
    setIsLoading(false);
  }, []);
  
  const activeToken = accountType === 'demo' ? demoToken : realToken;

  // Manage WebSocket connection
  useEffect(() => {
    if (!activeToken || isLoading) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setAccountBalance({ balance: null, currency: null, loading: false });
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // If token changes, we need to re-authorize on the same connection or reconnect.
        // For simplicity, let's reconnect.
        wsRef.current.close();
    }

    setIsConnecting(true);
    setConnectionError(null);
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Deriv WS Provider] Connection opened. Authorizing...");
      ws.send(JSON.stringify({ "authorize": activeToken }));
    };

    ws.onmessage = (event) => {
      const response = JSON.parse(event.data);
      
      if (response.error) {
        console.error("[Deriv WS Provider] Error received:", response.error.message);
        if (response.msg_type === 'authorize') {
            setConnectionError(response.error.message);
            setIsConnected(false);
            setIsConnecting(false);
        }
        // Handle promise rejections for proposals
        const proposalReqId = response.req_id;
        if (proposalReqId && proposalPromisesRef.current.has(String(proposalReqId))) {
            proposalPromisesRef.current.get(String(proposalReqId))?.reject(new Error(response.error.message));
            proposalPromisesRef.current.delete(String(proposalReqId));
        }
        return;
      }

      if (response.msg_type === 'authorize') {
        console.log("[Deriv WS Provider] Authorized successfully.");
        setIsConnected(true);
        setIsConnecting(false);
        setAccountBalance({
            balance: response.authorize.balance,
            currency: response.authorize.currency,
            loading: false
        });
      }

      // Handle proposal responses
       const proposalReqId = response.req_id;
       if (response.msg_type === 'proposal' && proposalReqId && proposalPromisesRef.current.has(String(proposalReqId))) {
            proposalPromisesRef.current.get(String(proposalReqId))?.resolve(response.proposal);
            proposalPromisesRef.current.delete(String(proposalReqId));
       }
       // Handle buy responses
       const buyReqId = response.req_id;
       if (response.msg_type === 'buy' && buyReqId && proposalPromisesRef.current.has(String(buyReqId))) {
           proposalPromisesRef.current.get(String(buyReqId))?.resolve(response.buy);
           proposalPromisesRef.current.delete(String(buyReqId));
       }

    };

    ws.onclose = () => {
      console.log("[Deriv WS Provider] Connection closed.");
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      console.error("[Deriv WS Provider] WebSocket error occurred.");
      setConnectionError("Failed to connect to Deriv API.");
      setIsConnecting(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [activeToken, isLoading]);


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
  
  const fetchBalance = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[Deriv WS Provider] Cannot fetch balance, WS not open.");
      return;
    }
    setAccountBalance(prev => ({...prev, loading: true}));
    wsRef.current.send(JSON.stringify({ "balance": 1 }));
  }, []);

  const executeTrade = useCallback(async (contractType: string, quantity: number, symbol: string): Promise<TradeResult> => {
      if (!wsRef.current || !isConnected) {
        throw new Error("A conexão com a Deriv API não está ativa.");
      }

      try {
        console.log("[Deriv Hook] Requesting proposal...");
        const proposal = await requestProposal(wsRef.current, { contractType, quantity, symbol }, proposalPromisesRef);
        if (!proposal || !proposal.id) {
          throw new Error("Falha ao obter uma proposta de negociação da API.");
        }
        
        console.log(`[Deriv Hook] Proposal received: ${proposal.id}. Buying...`);
        const buyResult = await buyContract(wsRef.current, proposal.id, proposal.ask_price, proposalPromisesRef);

        return {
          success: true,
          message: `Ordem do tipo "${contractType}" para ${symbol} no valor de ${quantity} USD executada com sucesso.`,
          contractId: buyResult.contract_id,
          entryTick: buyResult.entry_tick,
          entryTime: buyResult.entry_tick_time,
        };
      } catch (error) {
         console.error("[Deriv Hook] Erro durante a negociação:", error);
         const message = error instanceof Error ? error.message : "Um erro desconhecido ocorreu.";
         return { success: false, message };
      }

  }, [isConnected]);

  const contextValue: DerivApiContextType = {
    ws: wsRef.current,
    isConnected,
    isConnecting,
    connectionError,
    demoToken,
    realToken,
    activeToken,
    accountType,
    setAccountType,
    setTokens,
    disconnect,
    accountBalance,
    refreshBalance: fetchBalance,
    executeTrade,
  };

  if (isLoading) {
    return null; // Or a loading spinner for the whole app
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
