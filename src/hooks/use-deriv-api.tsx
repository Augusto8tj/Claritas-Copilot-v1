

'use client';

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import type { TradeResult, Asset, AssetGroup } from '@/services/deriv-api-service';
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
  promisesRef: React.MutableRefObject<Map<string, PromiseCallbacks>>;
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
      const storedDemoToken = localStorage.getItem(DERIV_DEMO_TOKEN_KEY);
      const storedRealToken = localStorage.getItem(DERIV_REAL_TOKEN_KEY);
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

  const requestProposal = useCallback(async (
    ws: WebSocket,
    params: { contractType: string; quantity: number; symbol: string; duration: number, duration_unit: DurationUnit }
  ): Promise<any> => {
      const req_id = Date.now() + Math.random();
      const proposalRequest = {
          "proposal": 1,
          "amount": params.quantity,
          "basis": "stake",
          "contract_type": params.contractType,
          "currency": "USD",
          "duration": params.duration,
          "duration_unit": params.duration_unit,
          "symbol": params.symbol,
          "req_id": req_id
      };

      return new Promise((resolve, reject) => {
          promisesRef.current.set(String(req_id), { resolve, reject });
          ws.send(JSON.stringify(proposalRequest));
      });
  }, []);

  const buyContract = useCallback(async (ws: WebSocket, proposalId: string, price: number): Promise<any> => {
      const req_id = Date.now() + Math.random();
      return new Promise((resolve, reject) => {
          promisesRef.current.set(String(req_id), { resolve, reject });
          ws.send(JSON.stringify({ "buy": proposalId, "price": price, "req_id": req_id }));
      });
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
      const ws = wsRef.current;
      if (!ws || !isConnected) {
        throw new Error("A conexão com a API da Deriv não está ativa.");
      }

      try {
        const proposalResponse = await requestProposal(ws, { 
            contractType, 
            quantity: stake, 
            symbol,
            duration: duration,
            duration_unit: durationUnit,
        });

        const proposal = proposalResponse.proposal;
        if (!proposal || !proposal.id) {
          throw new Error("Falha ao obter uma proposta de negociação da API.");
        }
        
        const buyResponse = await buyContract(ws, proposal.id, proposal.ask_price);
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
  }, [isConnected, requestProposal, buyContract]);
  
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
            if (response.error) {
                 if (response.error.code !== 'AlreadySubscribed') {
                    console.error(`[Deriv WS Provider] Error received: "${response.error.message}"`);
                 }
                const reqId = response.req_id;
                
                if (response.msg_type === 'authorize') {
                   setConnectionError(`Falha na autorização: ${response.error.message}`);
                   setIsConnected(false);
                   setIsConnecting(false);
                 }
                if (reqId && promisesRef.current.has(String(reqId))) {
                    const promise = promisesRef.current.get(String(reqId));
                    promise?.reject(response.error.message);
                    promisesRef.current.delete(String(reqId));
                }
                return;
            }

            const reqId = response.req_id;
            if (reqId && promisesRef.current.has(String(reqId))) {
                const promise = promisesRef.current.get(String(reqId));
                promise?.resolve(response);
                promisesRef.current.delete(String(reqId));
                return;
            }
            
            handleImmediateMessage(response);
        });
        
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
              ws.send(JSON.stringify({ "balance": 1, "subscribe": 1, "req_id": Date.now() }));
              ws.send(JSON.stringify({ "proposal_open_contract": 1, "subscribe": 1, "req_id": Date.now() + 1 }));
              ws.send(JSON.stringify({ active_symbols: 'full', product_type: 'basic', "req_id": Date.now() + 2 }));
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
                    let marketKey = symbol.market;
                    // Special handling for basket indices. They are part of 'synthetic_index' but conceptually separate.
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
                        market: marketKey, // Use the corrected marketKey
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
                  wsRef.current.send(JSON.stringify({ "balance": 1, "req_id": Date.now() + 3 }));
                }
                break;
        }
    }


    ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        const reqId = response.req_id;
        
        if (reqId && promisesRef.current.has(String(reqId))) {
            // This is a response to a promise, not a subscription message for this hook
            return;
        }
        
        messageQueueRef.current.push(response);
        if (!isProcessingQueueRef.current) {
            isProcessingQueueRef.current = true;
            processMessageQueue();
        }
    };
  
    ws.onopen = () => {
      ws.send(JSON.stringify({ "authorize": activeToken }));
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
  }, [activeToken, isLoading, toast, buyContract, requestProposal]);

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
    promisesRef,
    executeTrade,
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
