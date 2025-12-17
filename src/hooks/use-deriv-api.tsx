

'use client';

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import { requestProposal, buyContract } from '@/services/deriv-api-service';
import type { TradeResult } from '@/services/deriv-api-service';
import { useToast } from './use-toast';
import type { Operation } from '@/components/trading/operations-log.types';
import { analyzeOperationsAction } from '@/app/actions/trading-actions';
import type { TimePeriod, ChartType } from '@/app/deriv-trader/page';
import type { DurationUnit } from '@/components/trading/deriv-trader-interface';


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

export type TickData = {
  epoch: number;
  price: number;
};
export type CandleData = {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
};
export type ChartData = TickData | CandleData;


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
  priceTicks: TickData[];
  chartData: ChartData[];
  isChartLoading: boolean;
  chartError: string | null;
  chartType: ChartType;
  timePeriod: TimePeriod;
  addPriceTick: (tick: TickData) => void;
  setAccountType: (type: AccountType) => void;
  setTokens: (tokens: { demo?: string; real?: string }) => void;
  disconnect: (type: AccountType) => void;
  refreshBalance: () => void;
  executeTrade: (
    contractType: string, 
    quantity: number, 
    symbol: string, 
    tradeDirection: 'rise' | 'fall',
    duration: number,
    durationUnit: DurationUnit
  ) => Promise<TradeResult>;
  clearActiveContracts: () => void;
  addActiveContract: (contract: ActiveContract) => void;
  getAnalysis: (symbol: string) => Promise<string>;
  subscribeToSymbol: (symbol: string, timePeriod: TimePeriod, chartType: ChartType) => void;
  setChartType: (type: ChartType) => void;
  setTimePeriod: (period: TimePeriod) => void;
}

const DerivApiContext = createContext<DerivApiContextType | undefined>(undefined);

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 0; // This is for ticks, so granularity is not applicable in the same way, but API expects a value.
        case '15m': return 60 * 15;
        case '30m': return 60 * 30;
        case '1h': return 60 * 60;
        case '8h': return 60 * 60 * 8;
        case '1d': return 60 * 60 * 24;
        default: return 60; // Default to 1-minute candles
    }
}

export function DerivApiProvider({ children }: { children: ReactNode }) {
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [realToken, setRealToken] = useState<string | null>(null);
  const [accountType, setAccountTypeState] = useState<AccountType>('demo');
  const [accountBalance, setAccountBalance] = useState<AccountBalance>({ balance: null, currency: null, loading: true });
  const [isLoading, setIsLoading] = useState(true);
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [operationsLog, setOperationsLog] = useState<Operation[]>([]);
  const [priceTicks, setPriceTicks] = useState<TickData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('Area');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1m');

  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const promisesRef = useRef<Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>>(new Map());
  
  const activeSubscriptionId = useRef<string | null>(null);
  const activeSymbolRef = useRef<string | null>(null);


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
  
  const addPriceTick = (tick: TickData) => {
    setPriceTicks(prevTicks => {
        const newTicks = [...prevTicks, tick];
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
        if (!isConnected) { // Re-authorizing on same connection
             wsRef.current.send(JSON.stringify({ "authorize": activeToken }));
        }
    } else {
        setIsConnecting(true);
        setIsConnected(false);
        setConnectionError(null);
        const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[Deriv WS Provider] Connection opened. Authorizing...");
          ws.send(JSON.stringify({ "authorize": activeToken }));
        };

        ws.onclose = () => {
          console.log("[Deriv WS Provider] Connection closed.");
          setIsConnected(false);
          setIsConnecting(false);
          wsRef.current = null;
          activeSubscriptionId.current = null;
          activeSymbolRef.current = null;
        };

        ws.onerror = () => {
          console.error("[Deriv WS Provider] WebSocket error occurred.");
          setConnectionError("Failed to connect to Deriv API.");
          setIsConnecting(false);
          setIsConnected(false);
        };
    }
    
    const ws = wsRef.current;
    if(!ws) return;

    ws.onmessage = (event) => {
      const response = JSON.parse(event.data);
      
      if (response.error) {
        // Ignore "AlreadySubscribed" error as it's handled by our logic
        if (response.error.code !== 'AlreadySubscribed') {
           console.error("[Deriv WS Provider] Error received:", response.error.message);
        }
        const reqId = response.req_id;
        if (reqId && promisesRef.current.has(String(reqId))) {
            promisesRef.current.get(String(reqId))?.reject(new Error(response.error.message));
            promisesRef.current.delete(String(reqId));
        } else if (response.msg_type === 'authorize') {
            setConnectionError(response.error.message);
            setIsConnected(false);
        } else if (response.msg_type === 'ticks_history' || response.msg_type === 'candles') {
             setChartError(response.error.message);
             setIsChartLoading(false);
        } else if (response.error.code !== 'AlreadySubscribed') {
           console.error("[Deriv WS Provider] Unhandled error:", response.error.message);
        }
        return;
      }

      const reqId = response.req_id;
      if (reqId && promisesRef.current.has(String(reqId))) {
          promisesRef.current.get(String(reqId))?.resolve(response);
          promisesRef.current.delete(String(reqId));
          return;
      }

      if (response.msg_type === 'authorize') {
        console.log("[Deriv WS Provider] Authorized successfully.");
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
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
        if (tick.subscription) {
            activeSubscriptionId.current = tick.subscription;
        }
        const newTick = { epoch: tick.epoch, price: tick.quote };
        addPriceTick(newTick);
        if(chartType === 'Area') {
            setChartData(prev => [...prev.slice(-199), newTick]);
        }
      } else if (response.msg_type === 'ohlc') {
         const candle = response.ohlc;
         if (candle.subscription) {
             activeSubscriptionId.current = candle.subscription;
         }
         const newCandle: CandleData = {
            epoch: candle.epoch,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
         };
         setChartData(prev => {
            const data = prev as CandleData[];
            if (data.length > 0 && data[data.length - 1].epoch === newCandle.epoch) {
                // Update last candle
                const newData = [...data];
                newData[newData.length - 1] = newCandle;
                return newData;
            } else {
                // Add new candle
                return [...data.slice(-499), newCandle];
            }
        });
      } else if (response.msg_type === 'candles') {
         const candleData: CandleData[] = response.candles.map((candle: any) => ({
            epoch: candle.epoch,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
        }));
        setChartData(candleData);
        setIsChartLoading(false);
      } else if (response.msg_type === 'history') {
          const historyData = response.history.prices.map((price: number, index: number) => ({
              epoch: response.history.times[index],
              price: price,
          }));
          setChartData(historyData);
          setIsChartLoading(false);
      }
    };


    return () => {
      // Don't add removeEventListener here as it's managed once per connection
    };
  }, [activeToken, isLoading, isConnected, toast, chartType]);

 const subscribeToSymbol = useCallback(async (symbol: string, newTimePeriod: TimePeriod, newChartType: ChartType) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("[Deriv WS Provider] Cannot subscribe, WS not open or ready.");
        return;
    }

    setChartData([]);
    setIsChartLoading(true);
    setChartError(null);

    // Encapsulate forget request in a promise
    const forgetPreviousSubscription = () => {
        if (activeSubscriptionId.current) {
            console.log(`[Deriv WS Provider] Forgetting old subscription: ${activeSubscriptionId.current}`);
            const req_id = Date.now();
            return new Promise((resolve, reject) => {
                promisesRef.current.set(String(req_id), { resolve, reject });
                ws.send(JSON.stringify({ "forget": activeSubscriptionId.current, "req_id": req_id }));
                
                // Timeout to prevent getting stuck
                setTimeout(() => {
                    if (promisesRef.current.has(String(req_id))) {
                        console.warn("Forget request timed out.");
                        promisesRef.current.delete(String(req_id));
                        resolve(null); // Resolve anyway to continue the flow
                    }
                }, 3000);
            });
        }
        return Promise.resolve(null);
    };

    try {
        await forgetPreviousSubscription();
        activeSubscriptionId.current = null;
        console.log("[Deriv WS Provider] Old subscription forgotten. Subscribing to new symbol...");
    } catch (e) {
        console.warn("[Deriv WS Provider] Could not forget previous subscription, proceeding anyway.", e);
    }
    
    activeSymbolRef.current = symbol;

    const requestAndSubscribe = () => {
      if (newChartType === 'Area') {
          console.log(`[Deriv WS Provider] Subscribing to ticks for ${symbol}`);
          setPriceTicks([]);
          ws.send(JSON.stringify({ "ticks_history": symbol, "end": "latest", "count": 200, "style": "ticks", "subscribe": 1 }));
      } else {
          const granularity = getGranularityForTimePeriod(newTimePeriod);
          console.log(`[Deriv WS Provider] Subscribing to candles for ${symbol} with granularity ${granularity}`);
          ws.send(JSON.stringify({
              ticks_history: symbol,
              style: 'candles',
              end: 'latest',
              count: 500,
              granularity: granularity,
              subscribe: 1
          }));
      }
    }
    
    requestAndSubscribe();
    
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
  
  const refreshBalance = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[Deriv WS Provider] Cannot fetch balance, WS not open.");
      return;
    }
    setAccountBalance(prev => ({...prev, loading: true}));
    wsRef.current.send(JSON.stringify({ "balance": 1 }));
  }, []);

 const executeTrade = useCallback(async (
    contractType: string, 
    quantity: number, 
    symbol: string, 
    tradeDirection: 'rise' | 'fall',
    duration: number,
    durationUnit: DurationUnit
): Promise<TradeResult> => {
      if (!wsRef.current || !isConnected) {
        throw new Error("A conexão com a Deriv API não está ativa.");
      }

      try {
        const proposalResponse = await requestProposal(wsRef.current, { 
            contractType, 
            quantity, 
            symbol,
            duration: duration,
            duration_unit: durationUnit,
        }, promisesRef);

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
            duration: duration,
            durationUnit: durationUnit,
        };
        setOperationsLog(prevLog => [newOperation, ...prevLog]);


        return {
          success: true,
          message: `Ordem do tipo "${contractType}" para ${symbol} no valor de ${quantity} USD executada com sucesso.`,
          contractId: buyResult.contract_id,
          entryTick: buyResult.entry_tick_price,
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

  const getAnalysis = async (symbol: string): Promise<string> => {
    const closedOperations = operationsLog.filter(op => op.status !== 'pending' && op.asset === symbol);
    if(closedOperations.length === 0) {
        return "Não há operações concluídas suficientes para este ativo na sessão atual para fazer uma análise."
    }
    const response = await analyzeOperationsAction({ operations: closedOperations });
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
    chartData,
    isChartLoading,
    chartError,
    chartType,
    timePeriod,
    setChartType,
    setTimePeriod,
    addPriceTick,
    refreshBalance,
    executeTrade,
    clearActiveContracts,
    addActiveContract,
    getAnalysis,
    subscribeToSymbol
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
