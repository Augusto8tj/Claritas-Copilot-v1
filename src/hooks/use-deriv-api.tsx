

'use client';

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import { requestProposal, buyContract } from '@/services/deriv-api-service';
import type { TradeResult, Asset, AssetGroup } from '@/services/deriv-api-service';
import { useToast } from './use-toast';
import type { Operation, OperationInitiator } from '@/components/trading/operations-log.types';
import type { TimePeriod, ChartType } from '@/app/deriv-trader/page';
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
  volume?: number;
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
  activeSymbol: string | null;
  accountType: AccountType;
  accountBalance: AccountBalance;
  activeContracts: ActiveContract[];
  operationsLog: Operation[];
  chartData: ChartData[];
  assetGroups: AssetGroup[];
  isAssetsLoading: boolean;
  isChartLoading: boolean;
  chartError: string | null;
  chartType: ChartType;
  timePeriod: TimePeriod;
  showBollingerBands: boolean;
  setShowBollingerBands: (show: boolean) => void;
  setAccountType: (type: AccountType) => void;
  setActiveSymbol: (symbol: string) => void;
  setTokens: (tokens: { demo?: string; real?: string }) => void;
  disconnect: (type: AccountType) => void;
  refreshBalance: () => void;
  executeTrade: (
    contractType: string,
    stake: number,
    symbol: string,
    tradeDirection: 'rise' | 'fall',
    duration: number,
    durationUnit: DurationUnit,
    initiator: OperationInitiator,
  ) => Promise<TradeResult>;
  clearActiveContracts: () => void;
  addActiveContract: (contract: ActiveContract) => void;
  subscribeToSymbol: (symbol: string, timePeriod: TimePeriod, chartType: ChartType) => Promise<void>;
  setChartType: (type: ChartType) => void;
  setTimePeriod: (period: TimePeriod) => void;
}

const DerivApiContext = createContext<DerivApiContextType | undefined>(undefined);

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
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

export const DerivApiProvider = ({ children }: { children: ReactNode }) => {
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [realToken, setRealToken] = useState<string | null>(null);
  const [accountType, setAccountTypeState] = useState<AccountType>('demo');
  const [accountBalance, setAccountBalance] = useState<AccountBalance>({ balance: null, currency: null, loading: true });
  const [isLoading, setIsLoading] = useState(true);
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [operationsLog, setOperationsLog] = useState<Operation[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('Area');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('5m');
  const [showBollingerBands, setShowBollingerBands] = useState(true);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [isAssetsLoading, setIsAssetsLoading] = useState(true);

  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const promisesRef = useRef<Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>>(new Map());
  const subscriptionIdRef = useRef<string | null>(null);
  const isSubscribingRef = useRef(false);

  const messageQueueRef = useRef<any[]>([]);
  const isProcessingQueueRef = useRef(false);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const THROTTLE_INTERVAL = 250; 


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
        const proposalResponse = await requestProposal(wsRef.current, { 
            contractType, 
            quantity: stake, 
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
  }, [isConnected]);
  
 const subscribeToSymbol = useCallback(async (symbol: string, newTimePeriod: TimePeriod, newChartType: ChartType) => {
    if (isSubscribingRef.current) {
        console.warn("[Deriv WS Provider] Subscription already in progress. Ignoring.");
        return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("[Deriv WS Provider] Cannot subscribe, WS not open.");
        return;
    }
    
    isSubscribingRef.current = true;
    setActiveSymbol(symbol);
    setChartData([]);
    setIsChartLoading(true);
    setChartError(null);

    try {
        if (subscriptionIdRef.current) {
            console.log(`[Deriv WS Provider] Forgetting old subscription: ${subscriptionIdRef.current}`);
            ws.send(JSON.stringify({ "forget": subscriptionIdRef.current }));
        }

        const granularity = getGranularityForTimePeriod(newTimePeriod);
        const isTickHistory = granularity === 0;
        const style = isTickHistory ? 'ticks' : 'candles';

        const request: any = {
            ticks_history: symbol,
            style: style,
            end: 'latest',
            count: 1000, 
            subscribe: 1
        };

        if (style === 'candles') {
            request.granularity = granularity;
            request.adjust_start_time = 1;
        }
        
        console.log(`[Deriv WS Provider] Subscribing to ${symbol} with style: ${style} and granularity: ${granularity}`);
        ws.send(JSON.stringify(request));

    } catch (e: any) {
        console.error(`[Deriv WS Provider] Subscription Error: ${e.message}`);
        setChartError(e.message);
        setIsChartLoading(false);
        isSubscribingRef.current = false;
    }
}, []);
 
  useEffect(() => {
    if (!activeToken || isLoading) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        console.log("[Deriv WS Provider] Connection is already in progress. Waiting.");
        return;
    }
    
    if (wsRef.current) {
        wsRef.current.close();
    }

    console.log("[Deriv WS Provider] Creating new WebSocket connection.");
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

        let latestTick: TickData | null = null;
        let latestOHLC: CandleData | null = null;
        
        responsesToProcess.forEach(response => {
             const reqId = response.req_id;
             if (reqId && promisesRef.current.has(String(reqId))) {
                 promisesRef.current.get(String(reqId))?.resolve(response);
                 promisesRef.current.delete(String(reqId));
                 return; // Stop processing this message further
             }

             if (response.error) {
                 console.error(`[Deriv WS Provider] Error received: "${response.error.message}"`);
                 if (response.echo_req?.ticks_history || response.echo_req?.candles) {
                     setChartError(response.error.message);
                     setIsChartLoading(false);
                     isSubscribingRef.current = false;
                 }
                 return;
             }
             
             switch (response.msg_type) {
                case 'tick':
                    if (response.echo_req.ticks_history === activeSymbol) {
                      latestTick = { epoch: response.tick.epoch, price: response.tick.quote };
                    }
                    break;
                case 'ohlc':
                     if (response.echo_req.ticks_history === activeSymbol) {
                       latestOHLC = {
                           epoch: response.ohlc.epoch,
                           open: parseFloat(response.ohlc.open),
                           high: parseFloat(response.ohlc.high),
                           low: parseFloat(response.ohlc.low),
                           close: parseFloat(response.ohlc.close),
                           volume: response.ohlc.volume ? parseFloat(response.ohlc.volume) : undefined,
                       };
                     }
                    break;
                default:
                    handleImmediateMessage(response);
                    break;
             }
        });

        // Batch state updates
        if (latestTick) {
          const isTickChart = getGranularityForTimePeriod(timePeriod) === 0;
          if(isTickChart) {
              setChartData(prev => [...(prev as TickData[]).slice(-999), latestTick!]);
          }
        }

        if (latestOHLC) {
            setChartData(prev => {
                const data = [...(prev as CandleData[]).slice(-999)];
                if (data.length > 0 && data[data.length - 1].epoch === latestOHLC!.epoch) {
                    data[data.length - 1] = latestOHLC!;
                    return [...data];
                } else {
                    return [...data, latestOHLC!];
                }
            });
        }
        
        isProcessingQueueRef.current = false;
        if (messageQueueRef.current.length > 0) {
           throttleTimeoutRef.current = setTimeout(processMessageQueue, THROTTLE_INTERVAL);
        }
    };

    const handleImmediateMessage = (response: any) => {
      switch (response.msg_type) {
        case 'authorize':
          setIsConnected(true);
          setIsConnecting(false);
          setConnectionError(null);
          console.log("[Deriv WS Provider] Authorization successful.");
          ws.send(JSON.stringify({ "balance": 1, "subscribe": 1 }));
          ws.send(JSON.stringify({ "proposal_open_contract": 1, "subscribe": 1 }));
          ws.send(JSON.stringify({ active_symbols: 'full', product_type: 'basic' }));
          setIsAssetsLoading(true);
          break;

        case 'balance':
          setAccountBalance({
              balance: response.balance.balance,
              currency: response.balance.currency,
              loading: false
          });
          break;
        
        case 'active_symbols':
            const groupedAssets: { [key: string]: Asset[] } = {};
            response.active_symbols.forEach((symbol: any) => {
                const groupName = symbol.market_display_name;
                if (!groupedAssets[groupName]) { groupedAssets[groupName] = []; }
                groupedAssets[groupName].push({
                    value: symbol.symbol,
                    label: symbol.display_name,
                    marketIsOpen: symbol.exchange_is_open === 1,
                    submarket: symbol.submarket,
                    market: symbol.market,
                    minDuration: symbol.min_contract_duration,
                });
            });
            const finalAssetGroups: AssetGroup[] = Object.keys(groupedAssets)
                .map(label => ({ label, options: groupedAssets[label].sort((a, b) => a.label.localeCompare(b.label)) }))
                .sort((a, b) => a.label.localeCompare(b.label));
            setAssetGroups(finalAssetGroups);
            setIsAssetsLoading(false);
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
              wsRef.current.send(JSON.stringify({ "balance": 1 }));
            }
            break;
        
        case 'history':
        case 'candles':
            if (response.echo_req.subscribe === 1 && response.subscription?.id) {
                subscriptionIdRef.current = response.subscription.id;
            }
            const rawData = response.candles || response.history.prices.map((p:number, i:number) => ({
                epoch: response.history.times[i], close: p, open: p, high: p, low: p,
            }));
            const formattedData = rawData.map((c: any) => ({...c, open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low), close: parseFloat(c.close)}));

            if(response.history) {
              // This is tick data, but we store it in chartData for consistency
              setChartData(formattedData.map((d:any) => ({ epoch: d.epoch, price: d.close })));
            } else {
              setChartData(formattedData);
            }
            setIsChartLoading(false);
            isSubscribingRef.current = false;
            break;
            
        case 'forget':
          subscriptionIdRef.current = null;
          console.log(`[Deriv WS Provider] Successfully forgot subscription.`);
          break;
      }
    };

    ws.onmessage = (event) => {
        messageQueueRef.current.push(JSON.parse(event.data));
        if (!isProcessingQueueRef.current) {
            isProcessingQueueRef.current = true;
            processMessageQueue();
        }
    };
  
    ws.onopen = () => {
      console.log("[Deriv WS Provider] Connection opened. Authorizing...");
      ws.send(JSON.stringify({ "authorize": activeToken }));
    };
  
    ws.onclose = (event) => {
      const { wasClean, code, reason } = event;
      console.warn(`[Deriv WS Provider] Connection closed. Clean: ${wasClean}, Code: ${code}, Reason: ${reason || 'N/A'}`);
      setConnectionError(`A conexão foi fechada: Código ${code} (${reason || 'Fecho Anormal'}).`);
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;
    };
  
    ws.onerror = () => {
      console.error("[Deriv WS Provider] WebSocket error occurred.");
    };
  
    return () => {
      if (wsRef.current) {
        console.log("[Deriv WS Provider] Cleaning up WebSocket connection.");
        wsRef.current.close();
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, [activeToken, isLoading, toast, timePeriod, activeSymbol]);

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
    activeSymbol,
    accountType,
    setAccountType,
    setActiveSymbol,
    setTokens,
    disconnect,
    accountBalance,
    activeContracts,
    operationsLog,
    chartData,
    assetGroups,
    isAssetsLoading,
    isChartLoading,
    chartError,
    chartType,
    timePeriod,
    showBollingerBands,
    setShowBollingerBands,
    setChartType,
    setTimePeriod,
    refreshBalance,
    executeTrade,
    clearActiveContracts,
    addActiveContract,
    subscribeToSymbol,
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
