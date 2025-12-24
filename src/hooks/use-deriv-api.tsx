

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

// Callback para passar dados de mercado para outros hooks
export type MarketDataCallback = (data: any) => void;

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
  priceTicks: { epoch: number, price: number }[]; // Expose price ticks
  setAccountType: (type: AccountType) => void;
  setTokens: (tokens: { demo?: string; real?: string }) => void;
  disconnect: (type: AccountType) => void;
  makeRequest: <T,>(request: object) => Promise<T>;
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
  // Nova função para registrar um ouvinte de dados de mercado
  addMarketDataListener: (callback: MarketDataCallback) => void;
  // Nova função para remover o ouvinte
  removeMarketDataListener: (callback: MarketDataCallback) => void;
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
  const [priceTicks, setPriceTicks] = useState<{ epoch: number, price: number }[]>([]); // State for price ticks
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const promisesRef = useRef<Map<string, PromiseCallbacks>>(new Map());
  // Lista de callbacks para notificar sobre novos dados de mercado
  const marketDataListenersRef = useRef<MarketDataCallback[]>([]);

  const messageQueueRef = useRef<any[]>([]);
  const isProcessingQueueRef = useRef(false);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const THROTTLE_INTERVAL = 250;

  useEffect(() => {
    try {
      const storedDemoToken = localStorage.getItem(DERIV_DEMO_TOKEN_KEY);
      const storedRealToken = localStorage.getItem(DERIV_REAL_TOKEN_KEY);
      const storedAccountType = localStorage.getItem(DERIV_ACCOUNT_TYPE_KEY) as AccountType | null;
      
      setDemoToken(storedDemoToken);
      setRealToken(storedRealToken);
      if (storedAccountType) setAccountTypeState(storedAccountType);
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    setIsLoading(false);
  }, []);
  
  const activeToken = accountType === 'demo' ? demoToken : realToken;

    const makeRequest = useCallback(<T,>(request: object): Promise<T> => {
    return new Promise((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return reject(new Error("WebSocket is not connected."));
        }
        
        const req_id = Date.now() + Math.floor(Math.random() * 1000000);
        const payload = { ...request, req_id };
        
        console.log('[Deriv WS] Making request:', { type: Object.keys(request)[0], req_id });
        
        promisesRef.current.set(String(req_id), { resolve, reject });
        
        const timeoutId = setTimeout(() => {
            if (promisesRef.current.has(String(req_id))) {
                promisesRef.current.delete(String(req_id));
                reject(new Error(`Request timed out for req_id: ${req_id}`));
            }
        }, 15000);
        
        const originalResolve = resolve;
        const originalReject = reject;
        
        promisesRef.current.set(String(req_id), {
            resolve: (value: any) => {
                clearTimeout(timeoutId);
                originalResolve(value);
            },
            reject: (reason: any) => {
                clearTimeout(timeoutId);
                originalReject(reason);
            }
        });

        ws.send(JSON.stringify(payload));
    });
  }, []);
  
  const getHistoricalData = useCallback(async (symbol: string, period?: string, count?: number): Promise<HistoricalData[]> => {
      if (!wsRef.current || !isConnected) {
        throw new Error("A conexão com a API da Deriv não está ativa.");
      }
      const request: any = {
        ticks_history: symbol,
        end: "latest",
        count: count || 1000,
      };

      if(period && getGranularityForTimePeriod(period as any)) {
          request.style = 'candles';
          request.granularity = getGranularityForTimePeriod(period as any);
      } else {
          request.style = 'ticks';
      }

      const response: any = await makeRequest(request);
      
      if(response.history) {
          return response.history.times.map((time: number, index: number) => ({
              date: new Date(time * 1000).toISOString(),
              price: response.history.prices[index]
          }));
      }
      if(response.candles) {
           return response.candles.map((candle: any) => ({
                date: new Date(candle.epoch * 1000).toISOString(),
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            }));
      }

      return [];
  }, [isConnected, makeRequest]);


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

    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        return;
    }
    
    setIsConnecting(true);
    setConnectionError(null);
    setIsAssetsLoading(true);
  
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    wsRef.current = ws;

    const handleSubscriptionMessage = (response: any) => {
      // Notifica todos os ouvintes sobre a nova mensagem
      marketDataListenersRef.current.forEach(callback => callback(response));
      
      switch (response.msg_type) {
         case 'tick':
           if (response.tick) {
              setPriceTicks(prev => [...prev.slice(-999), { epoch: response.tick.epoch, price: response.tick.quote }]);
           }
           break;
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
                const req_id = Date.now() + Math.floor(Math.random() * 1000000);
                wsRef.current.send(JSON.stringify({"balance": 1, "req_id": req_id}));
             }
             break;
      }
    }
    
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
                promisesRef.current.delete(String(reqId));
                
                if (response.error) {
                    const errorMsg = response.error.message || 'Unknown error';
                    const errorCode = response.error.code || 'NO_CODE';
                    console.error('[Deriv WS] Request error:', { code: errorCode, message: errorMsg, full: response.error });
                    promise?.reject(new Error(`${errorCode}: ${errorMsg}`));
                } else {
                    promise?.resolve(response);
                }
                return;
            }
            
            if (response.error) {
                if (response.error.code !== 'AlreadySubscribed') {
                    console.error(`[Deriv WS Provider] Error received:`, response.error);
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

    ws.onmessage = (event) => {
      try {
          const response = JSON.parse(event.data);
          
          if (response.msg_type === 'authorize' || response.error) {
              console.log('[Deriv WS] Received message:', response);
          }
          
          messageQueueRef.current.push(response);
          
          if (!isProcessingQueueRef.current) {
              isProcessingQueueRef.current = true;
              processMessageQueue();
          }
      } catch (parseError) {
          console.error('[Deriv WS] Failed to parse message:', parseError);
      }
    };

    ws.onopen = async () => {
        console.log('[Deriv WS] Connection opened, attempting authorization...');
        
        try {
            const authResponse: any = await makeRequest({ authorize: activeToken });
    
            console.log('[Deriv WS] Authorization successful');
            
            setIsConnected(true);
            setIsConnecting(false);
            setConnectionError(null);
            
            ws.send(JSON.stringify({ "proposal_open_contract": 1, "subscribe": 1 }));
            ws.send(JSON.stringify({ "balance": 1, "subscribe": 1 }));
    
            console.log('[Deriv WS] Requesting active symbols...');
            const assetsRes: any = await makeRequest({ active_symbols: 'full', product_type: 'basic' });
    
            console.log('[Deriv WS] Received assets response');
    
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
            setIsAssetsLoading(false);
            
            console.log('[Deriv WS] Initialization complete, loaded', finalAssetGroups.length, 'asset groups');
    
        } catch (error: any) {
            console.error('[Deriv WS] Initialization error:', error);
            
            let errorMessage = 'Erro desconhecido ao conectar';
            if (error instanceof Error) { errorMessage = error.message; }
            
            setConnectionError(`Falha na inicialização: ${errorMessage}`);
            setIsConnected(false);
            setIsConnecting(false);
            setIsAssetsLoading(false);
            
            if (ws.readyState === WebSocket.OPEN) { ws.close(); }
        }
    };
  
    ws.onclose = (event) => {
      console.log('[Deriv WS] Connection closed', event.reason);
      const { wasClean, code, reason } = event;
      if (!wasClean) {
        setConnectionError(`A conexão foi fechada: Código ${code} (${reason || 'Fecho Anormal'}).`);
      }
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;
    };
  
    ws.onerror = (error) => {
      console.error('[Deriv WS] WebSocket error:', error);
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
  }, [activeToken, isLoading, makeRequest]);


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
  
  const getGranularityForTimePeriod = (timePeriod: any): number => {
    switch(timePeriod) {
        case '1m': return 0;
        case '2m': return 120;
        case '3m': return 180;
        case '5m': return 300;
        case '10m': return 600;
        case '15m': return 900;
        case '30m': return 1800;
        case '1h': return 3600;
        case '8h': return 28800;
        case '1d': return 86400;
        default: return 0;
    }
  }

  const addMarketDataListener = (callback: MarketDataCallback) => {
    marketDataListenersRef.current.push(callback);
  };

  const removeMarketDataListener = (callback: MarketDataCallback) => {
    marketDataListenersRef.current = marketDataListenersRef.current.filter(
      (cb) => cb !== callback
    );
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
    assetGroups,
    isAssetsLoading,
    priceTicks, // Expose price ticks
    makeRequest,
    executeTrade,
    getHistoricalData,
    clearActiveContracts,
    addActiveContract,
    addMarketDataListener,
    removeMarketDataListener,
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
