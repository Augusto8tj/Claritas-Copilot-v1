
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import type { TradeResult, Asset, AssetGroup, HistoricalData } from '@/services/deriv-api-service';
import { useToast } from './use-toast';
import type { Operation, OperationInitiator } from '@/components/trading/operations-log.types';
import type { DurationUnit } from '@/components/trading/deriv-trader-interface.types';

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
  exitTick?: number;
  exitTime?: number;
  initiator: OperationInitiator;
}

export type PromiseCallbacks = { 
  resolve: (value: any) => void; 
  reject: (reason?: any) => void 
};

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
  assetGroups: AssetGroup[];
  isAssetsLoading: boolean;
  setAccountType: (type: AccountType) => void;
  setTokens: (tokens: { demo?: string; real?: string }) => void;
  disconnect: (type: AccountType) => void;
  executeTrade: (
    contractType: string,
    stake: number,
    symbol: string,
    tradeDirection: 'rise' | 'fall',
    duration: number,
    durationUnit: DurationUnit,
    initiator: OperationInitiator,
  ) => Promise<TradeResult>;
  getHistoricalData: (symbol: string, period?: string, count?: number) => Promise<HistoricalData[]>;
  clearActiveContracts: () => void;
  addActiveContract: (contract: ActiveContract) => void;
}

const DerivApiContext = createContext<DerivApiContextType | undefined>(undefined);

// Mapeia os valores de 'market' da API para nomes de grupo legíveis.
const marketNameMapping: Record<string, string> = {
    'synthetic_index': 'Índices Sintéticos',
    'forex': 'Forex',
    'commodities': 'Matérias-Primas',
    'stock_index': 'Índices de Ações',
    'cryptocurrency': 'Criptomoedas',
    'basket_index': 'Cestas de Moedas e Matérias-Primas'
};


export const DerivApiProvider = ({ children }: { children: ReactNode }) => {
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [realToken, setRealToken] = useState<string | null>(null);
  const [accountType, setAccountTypeState] = useState<AccountType>('demo');
  const [accountBalance, setAccountBalance] = useState<AccountBalance>({ balance: null, currency: null, loading: true });
  const [isLoading, setIsLoading] = useState(true);
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [operationsLog, setOperationsLog] = useState<Operation[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [isAssetsLoading, setIsAssetsLoading] = useState(true);
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const promisesRef = useRef<Map<string, PromiseCallbacks>>(new Map());

  const messageQueueRef = useRef<any[]>([]);
  const isProcessingQueueRef = useRef(false);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const THROTTLE_INTERVAL = 250;

  useEffect(() => {
    try {
      const storedDemoToken = localStorage.getItem(DERIV_DEMO_TOKEN_KEY) || process.env.NEXT_PUBLIC_DERIV_DEMO_TOKEN;
      const storedRealToken = localStorage.getItem(DERIV_REAL_TOKEN_KEY) || process.env.NEXT_PUBLIC_DERIV_REAL_TOKEN;
      const storedAccountType = localStorage.getItem(DERIV_ACCOUNT_TYPE_KEY) as AccountType | null;
      
      setDemoToken(storedDemoToken || null);
      setRealToken(storedRealToken || null);
      if (storedAccountType) setAccountTypeState(storedAccountType);
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    setIsLoading(false);
  }, []);
  
  const activeToken = accountType === 'demo' ? demoToken : realToken;

  const makeRequest = useCallback(<T>(request: object): Promise<T> => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket is not connected."));
    }
    const req_id = Date.now() + Math.random();
    const payload = { ...request, req_id };
    return new Promise((resolve, reject) => {
      promisesRef.current.set(String(req_id), { resolve, reject });
      ws.send(JSON.stringify(payload));
    });
  }, []);
  
  const getHistoricalData = useCallback(async (symbol: string, period?: string, count?: number): Promise<HistoricalData[]> => {
      // For now, we keep the mock implementation to avoid excessive API calls during development.
      // This can be replaced with a real API call using `makeRequest` in the future.
      console.log(`[Deriv Hook] Mocking historical data for ${symbol}. Count: ${count}, Period: ${period}.`);
      
      await new Promise(resolve => setTimeout(resolve, count ? 500 : 1200));

      const data: HistoricalData[] = [];
      
      if (count) { // High-frequency data
          let price = Math.random() * 200 + 50;
          for (let i = 0; i < count; i++) {
              const date = new Date();
              date.setSeconds(date.getSeconds() - (count - i));
              const trend = Math.sin(i / 20) * 0.1;
              const volatility = (Math.random() - 0.5) * 0.5;
              price += trend + volatility;
              if (price < 1) price = 1;
              data.push({ date: date.toISOString(), price: parseFloat(price.toFixed(4)) });
          }
      } else { // Long-term data
          const endDate = new Date();
          let days = 30;
          if (period && (period.includes("ano") || period.includes("year"))) days = 365;
          else if (period && (period.includes("mes") || period.includes("month"))) days = 30 * (parseInt(period) || 1);
          
          let price = Math.random() * 200 + 50;
          for (let i = 0; i < days; i++) {
              const date = new Date(endDate);
              date.setDate(date.getDate() - (days - i - 1));
              const trend = Math.sin(i / 50) * 0.5;
              const volatility = (Math.random() - 0.5) * 4;
              price += trend + volatility;
              if (price < 5) price = 5;
              data.push({ date: date.toISOString().split('T')[0], price: parseFloat(price.toFixed(2)) });
          }
      }
      return data;
  }, []);


  const executeTrade = useCallback(async (
    contractType: string,
    stake: number,
    symbol: string,
    tradeDirection: 'rise' | 'fall',
    duration: number,
    durationUnit: DurationUnit,
    initiator: OperationInitiator
  ): Promise<TradeResult> => {
      if (!wsRef.current || !isConnected) {
        throw new Error("A conexão com a API da Deriv não está ativa.");
      }

      try {
        const proposalResponse: any = await makeRequest({ 
            "proposal": 1,
            "amount": stake,
            "basis": "stake",
            "contract_type": contractType,
            "currency": "USD",
            "duration": duration,
            "duration_unit": durationUnit,
            "symbol": symbol,
        });

        const proposal = proposalResponse.proposal;
        if (!proposal || !proposal.id) {
          throw new Error("Falha ao obter uma proposta de negociação da API.");
        }
        
        const buyResponse: any = await makeRequest({ "buy": proposal.id, "price": proposal.ask_price });
        const buyResult = buyResponse.buy;
        
        const newOperation: Operation = {
            id: buyResult.contract_id,
            asset: symbol,
            direction: tradeDirection,
            stake: stake,
            status: 'pending',
            timestamp: new Date().toISOString(),
            duration: duration,
            durationUnit: durationUnit,
            initiator,
        };
        setOperationsLog(prevLog => [newOperation, ...prevLog]);

        return {
          success: true,
          message: `Ordem do tipo "${contractType}" para ${symbol} no valor de ${stake} USD executada com sucesso.`,
          contractId: buyResult.contract_id,
          entryTick: buyResult.entry_tick,
          entryTime: buyResult.entry_tick_time,
        };
      } catch (error) {
         console.error("[Deriv Hook] Erro durante a negociação:", error);
         const message = error instanceof Error ? error.message : "Um erro desconhecido ocorreu.";
         return { success: false, message };
      }
  }, [isConnected, makeRequest]);
  
  useEffect(() => {
    if (!activeToken || isLoading) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        return;
    }
    
    if (wsRef.current) {
        wsRef.current.close();
    }

    setIsConnecting(true);
    setConnectionError(null);
  
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    wsRef.current = ws;
  
    const processMessageQueue = () => {
        if (messageQueueRef.current.length === 0) {
            isProcessingQueueRef.current = false;
            return;
        }

        const responsesToProcess = [...messageQueueRef.current];
        messageQueueRef.current = [];

        responsesToProcess.forEach(response => {
            const reqId = response.req_id;
            if (reqId && promisesRef.current.has(String(reqId))) {
                const promise = promisesRef.current.get(String(reqId));
                if (response.error) {
                    promise?.reject(response.error.message);
                } else {
                    promise?.resolve(response);
                }
                promisesRef.current.delete(String(reqId));
                return;
            }
            
            if (response.error) {
                 if (response.error.code !== 'AlreadySubscribed') {
                    console.error(`[Deriv WS Provider] Error received: "${response.error.message}"`);
                 }
                return;
            }
            
            handleSubscriptionMessage(response);
        });
        
        isProcessingQueueRef.current = false;
        if (messageQueueRef.current.length > 0) {
           throttleTimeoutRef.current = setTimeout(processMessageQueue, THROTTLE_INTERVAL);
        }
    };

    const handleSubscriptionMessage = (response: any) => {
         switch (response.msg_type) {
            case 'balance':
              setAccountBalance({
                  balance: response.balance.balance,
                  currency: response.balance.currency,
                  loading: false
              });
              break;
            
            case 'proposal_open_contract':
                const contract = response.proposal_open_contract;
                if (!contract || !contract.is_sold) return;
                
                const profit = parseFloat(contract.profit);
                const isLoss = profit < 0;

                toast({
                    title: "Negociação Encerrada",
                    description: `Contrato ${contract.contract_id}: ${profit >= 0 ? `Lucro de ${contract.currency} ${profit.toFixed(2)}` : `Prejuízo de ${contract.currency} ${Math.abs(profit).toFixed(2)}`}`,
                    variant: isLoss ? "destructive" : "default",
                });

                setOperationsLog(prevLog => prevLog.map(op =>
                      op.id === contract.contract_id ? { ...op, status: profit >= 0 ? 'won' : 'lost', result: profit } : op
                ));
                
                setActiveContracts(prev => prev.map(c => 
                  c.contractId === contract.contract_id 
                    ? { ...c, status: profit >= 0 ? 'won' : 'lost', exitTick: parseFloat(contract.exit_tick_display_value), exitTime: contract.exit_tick_time }
                    : c
                ));

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  makeRequest({"balance": 1}).then((res: any) => handleSubscriptionMessage(res));
                }
                break;
        }
    }


    ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        messageQueueRef.current.push(response);
        if (!isProcessingQueueRef.current) {
            isProcessingQueueRef.current = true;
            processMessageQueue();
        }
    };
  
    ws.onopen = async () => {
        try {
            await makeRequest({ "authorize": activeToken });
            setIsConnected(true);
            setIsConnecting(false);
            setConnectionError(null);
            
            // Sequentially request initial data
            const balanceRes: any = await makeRequest({ "balance": 1, "subscribe": 1 });
            handleSubscriptionMessage(balanceRes);
            
            await makeRequest({ "proposal_open_contract": 1, "subscribe": 1 });

        } catch (error: any) {
            setConnectionError(`Falha na inicialização: ${error}`);
            setIsConnected(false);
            setIsConnecting(false);
            ws.close();
        }
    };
  
    ws.onclose = (event) => {
      const { wasClean, code, reason } = event;
      if (!wasClean) {
        setConnectionError(`A conexão foi fechada: Código ${code} (${reason || 'Fecho Anormal'}).`);
      }
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;
    };
  
    ws.onerror = () => {
      setConnectionError("Falha na conexão com a API da Deriv. Verifique o seu token e a ligação à internet.");
      setIsConnecting(false);
      setIsConnected(false);
    };
  
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
       if (throttleTimeoutRef.current) {
          clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, [activeToken, isLoading, toast, makeRequest]);

  // Effect to fetch active symbols after connection
  useEffect(() => {
    if (isConnected && isAssetsLoading) {
      makeRequest({ active_symbols: 'full', product_type: 'basic' })
        .then((assetsRes: any) => {
          const groupedAssets: { [key: string]: Asset[] } = {};
          assetsRes.active_symbols.forEach((symbol: any) => {
            let marketKey = symbol.market;
            if (symbol.market === 'synthetic_index' && symbol.submarket === 'basket_index') {
              marketKey = 'basket_index';
            }
            const groupName = marketNameMapping[marketKey] || 'Outros';
            if (!groupedAssets[groupName]) {
              groupedAssets[groupName] = [];
            }
            groupedAssets[groupName].push({
              value: symbol.symbol,
              label: symbol.display_name,
              marketIsOpen: symbol.exchange_is_open === 1,
              submarket: symbol.submarket,
              market: marketKey,
              minDuration: symbol.min_contract_duration,
            });
          });
          const finalAssetGroups: AssetGroup[] = Object.keys(groupedAssets)
            .map(label => ({ label, options: groupedAssets[label].sort((a, b) => a.label.localeCompare(b.label)) }))
            .sort((a, b) => a.label.localeCompare(b.label));
          setAssetGroups(finalAssetGroups);
        })
        .catch(error => {
          console.error("Failed to fetch active symbols:", error);
          setConnectionError("Failed to load asset list.");
        })
        .finally(() => {
          setIsAssetsLoading(false);
        });
    }
  }, [isConnected, isAssetsLoading, makeRequest]);

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

  const clearActiveContracts = () => {
    setActiveContracts([]);
  };

  const addActiveContract = (contract: ActiveContract) => {
    setActiveContracts(prev => [...prev, contract]);
  }

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
    assetGroups,
    isAssetsLoading,
    executeTrade,
    getHistoricalData,
    clearActiveContracts,
    addActiveContract,
  };

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
