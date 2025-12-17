
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import { requestProposal, buyContract } from '@/services/deriv-api-service';
import type { TradeResult } from '@/services/deriv-api-service';
import { useToast } from './use-toast';
import type { Operation } from '@/components/trading/operations-log.types';
import { analyzeOperationsAction } from '@/app/actions/trading-actions';


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

export interface ActiveContract {
  contractId: number;
  entryTick: number;
  entryTime: number;
  status?: 'open' | 'won' | 'lost';
  exit_tick?: number;
}

export interface PriceTick {
    epoch: number;
    price: number;
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
  activeContracts: ActiveContract[];
  operationsLog: Operation[];
  priceTicks: PriceTick[];
  addPriceTick: (tick: PriceTick) => void;
  setAccountType: (type: AccountType) => void;
  setTokens: (tokens: { demo?: string; real?: string }) => void;
  disconnect: (type: AccountType) => void;
  refreshBalance: () => void;
  executeTrade: (contractType: string, quantity: number, symbol: string, tradeDirection: 'rise' | 'fall') => Promise<TradeResult>;
  clearActiveContracts: () => void;
  addActiveContract: (contract: ActiveContract) => void;
  getAnalysis: () => Promise<string>;
}

const DerivApiContext = createContext<DerivApiContextType | undefined>(undefined);

export function DerivApiProvider({ children }: { children: ReactNode }) {
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [realToken, setRealToken] = useState<string | null>(null);
  const [accountType, setAccountTypeState] = useState<AccountType>('demo');
  const [accountBalance, setAccountBalance] = useState<AccountBalance>({ balance: null, currency: null, loading: true });
  const [isLoading, setIsLoading] = useState(true);
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [operationsLog, setOperationsLog] = useState<Operation[]>([]);
  const [priceTicks, setPriceTicks] = useState<PriceTick[]>([]);
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const promisesRef = useRef<Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>>(new Map());


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
  
  const addPriceTick = (tick: PriceTick) => {
    setPriceTicks(prevTicks => {
        const newTicks = [...prevTicks, tick];
        // Keep only the last 200 ticks to avoid memory issues
        if (newTicks.length > 200) {
            return newTicks.slice(newTicks.length - 200);
        }
        return newTicks;
    });
  };


  useEffect(() => {
    if (!activeToken || isLoading) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setIsConnected(false);
      setIsConnecting(false);
      setAccountBalance({ balance: null, currency: null, loading: false });
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
    }

    setIsConnecting(true);
    setIsConnected(false);
    setConnectionError(null);
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Deriv WS Provider] Connection opened. Authorizing...");
      ws.send(JSON.stringify({ "authorize": activeToken }));
      // Set connecting false right after opening, authorization will determine final connected state
      setIsConnecting(false);
      // We are technically connected to the server, but not yet authorized
    };

    ws.onmessage = (event) => {
      const response = JSON.parse(event.data);
      
      if (response.error) {
        console.error("[Deriv WS Provider] Error received:", response.error.message);
        const reqId = response.req_id;
        if (reqId && promisesRef.current.has(String(reqId))) {
            promisesRef.current.get(String(reqId))?.reject(new Error(response.error.message));
            promisesRef.current.delete(String(reqId));
        } else if (response.msg_type === 'authorize') {
            setConnectionError(response.error.message);
            setIsConnected(false);
        }
        return;
      }

      const reqId = response.req_id;
      if (reqId && promisesRef.current.has(String(reqId))) {
          promisesRef.current.get(String(reqId))?.resolve(response);
          promisesRef.current.delete(String(reqId));
          return; // It was a response to a specific promise.
      }


      if (response.msg_type === 'authorize') {
        console.log("[Deriv WS Provider] Authorized successfully.");
        setIsConnected(true);
        ws.send(JSON.stringify({ "balance": 1, "subscribe": 1 }));
        ws.send(JSON.stringify({ "proposal_open_contract": 1, "subscribe": 1 }));
      } else if (response.msg_type === 'balance') {
        setAccountBalance({
            balance: response.balance.balance,
            currency: response.balance.currency,
            loading: false
        });
      } else if (response.msg_type === 'proposal_open_contract') {
          const contract = response.proposal_open_contract;
          if (!contract || !contract.is_sold) return;
          
          const profit = parseFloat(contract.profit);
          const profitLossMessage = profit >= 0 ? `Lucro de ${contract.currency} ${profit.toFixed(2)}` : `Prejuízo de ${contract.currency} ${Math.abs(profit).toFixed(2)}`;

          toast({
              title: "Negociação Encerrada",
              description: `Contrato ${contract.contract_id}: ${profitLossMessage}`,
              variant: profit >= 0 ? "default" : "destructive",
          });

           setOperationsLog(prevLog =>
              prevLog.map(op =>
                op.id === contract.contract_id
                  ? { ...op, status: profit >= 0 ? 'won' : 'lost', result: profit }
                  : op
              )
            );
          
          setActiveContracts(prev => prev.filter(c => c.contractId !== contract.contract_id));

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ "balance": 1 }));
          }
      } else if (response.msg_type === 'tick') {
        const tick = response.tick;
        addPriceTick({ epoch: tick.epoch, price: tick.quote });
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
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [activeToken, isLoading, toast]);


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
  
  const refreshBalance = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[Deriv WS Provider] Cannot fetch balance, WS not open.");
      return;
    }
    setAccountBalance(prev => ({...prev, loading: true}));
    wsRef.current.send(JSON.stringify({ "balance": 1 }));
  }, []);

 const executeTrade = useCallback(async (contractType: string, quantity: number, symbol: string, tradeDirection: 'rise' | 'fall'): Promise<TradeResult> => {
      if (!wsRef.current || !isConnected) {
        throw new Error("A conexão com a Deriv API não está ativa.");
      }

      try {
        const proposalResponse = await requestProposal(wsRef.current, { contractType, quantity, symbol }, promisesRef);
        const proposal = proposalResponse.proposal;
        if (!proposal || !proposal.id) {
          throw new Error("Falha ao obter uma proposta de negociação da API.");
        }
        
        const buyResponse = await buyContract(wsRef.current, proposal.id, proposal.ask_price, promisesRef);
        const buyResult = buyResponse.buy;
        
        const newOperation: Operation = {
            id: buyResult.contract_id,
            asset: symbol,
            direction: tradeDirection,
            stake: quantity,
            status: 'pending',
            timestamp: new Date().toISOString(),
        };
        setOperationsLog(prevLog => [newOperation, ...prevLog]);


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

  const clearActiveContracts = () => setActiveContracts([]);
  
  const addActiveContract = (contract: ActiveContract) => {
    setActiveContracts(prev => [...prev, contract]);
  }

  const getAnalysis = async (): Promise<string> => {
    const response = await analyzeOperationsAction({ operations: operationsLog });
    if (response.success) {
      return response.success;
    }
    return `Erro: ${response.error || 'Falha ao obter análise.'}`;
  };

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
    activeContracts,
    operationsLog,
    priceTicks,
    addPriceTick,
    refreshBalance,
    executeTrade,
    clearActiveContracts,
    addActiveContract,
    getAnalysis,
  };

  if (isLoading) {
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
