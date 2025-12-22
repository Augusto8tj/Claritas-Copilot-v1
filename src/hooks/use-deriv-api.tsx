
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react';
import { requestProposal, buyContract, getHistoricalData as getHistoricalDataFromApi } from '@/services/deriv-api-service';
import type { TradeResult } from '@/services/deriv-api-service';
import { useToast } from './use-toast';
import type { Operation, OperationInitiator, RobotPerformance } from '@/components/trading/operations-log.types';
import { analyzeOperationsAction } from '@/app/actions/trading-actions';
import { analyzeTradeLossAction, getAutotraderStrategyAction, getStrategyCouncilAction } from '@/app/actions/ai-actions';
import type { AutoTraderStrategyOutput } from "@/ai/flows/auto-trader-strategy-flow.types";
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import type { TimePeriod, ChartType } from '@/app/deriv-trader/page';
import type { DurationUnit } from '@/components/trading/deriv-trader-interface.types';


const DERIV_DEMO_TOKEN_KEY = 'derivDemoApiToken';
const DERIV_REAL_TOKEN_KEY = 'derivRealApiToken';
const DERIV_ACCOUNT_TYPE_KEY = 'derivAccountType';
const HALL_OF_FAME_KEY = 'derivHallOfFame';
const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';
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
  isAutopilotOn: boolean;
  setIsAutopilotOn: (isOn: boolean) => void;
  autopilotStrategy: AutoTraderStrategyOutput | null;
  fetchAutopilotStrategy: () => Promise<void>;
  isCouncilAutopilotOn: boolean;
  setIsCouncilAutopilotOn: (isOn: boolean) => void;
  strategyCouncil: RobotStrategy[];
  isFetchingCouncil: boolean;
  fetchStrategyCouncil: (durationUnit: DurationUnit) => Promise<void>;
  councilVotes: { [key: string]: 'RISE' | 'FALL' | 'HOLD' };
  consensusThreshold: number;
  setConsensusThreshold: (threshold: number) => void;
  isDynamicConsensusOn: boolean;
  setIsDynamicConsensusOn: (isOn: boolean) => void;
  robotPerformance: RobotPerformance[];
  currentRSI: number | null;
  currentStoch: number | null;
  currentMA: { short: number | null, long: number | null };
  currentBollingerBands: { upper: number, middle: number, lower: number } | null;
  currentMACD: { macd: number, signal: number } | null;
  currentPriceAction: string | null;
  currentADX: number | null;
  currentIchimoku: { inCloud: boolean, trend: 'bullish' | 'bearish' | 'neutral' } | null;
  currentAwesomeOscillator: number | null;
  currentVolumePoc: number | null;
  geminiRequestCount: number;
  dailyBalance: number;
  setDailyBalance: (balance: number) => void;
  dailyTarget: number;
  setDailyTarget: (target: number) => void;
  setAccountType: (type: AccountType) => void;
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
  getAnalysis: (symbol: string) => Promise<string>;
  subscribeToSymbol: (symbol: string, timePeriod: TimePeriod, chartType: ChartType) => Promise<void>;
  setChartType: (type: ChartType) => void;
  setTimePeriod: (period: TimePeriod) => void;
  clearChartData: () => void;
}

const DerivApiContext = createContext<DerivApiContextType | undefined>(undefined);

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 0; // Ticks
        case '2m': return 120;
        case '3m': return 180;
        case '5m': return 300;
        case '15m': return 900; 
        case '30m': return 1800;
        case '1h': return 3600;
        case '8h': return 28800;
        case '1d': return 86400;
        default: return 0;
    }
}

// Indicator Calculation Helpers
const calculateMA = (data: { price: number }[], period: number) => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const sum = relevantData.reduce((acc, tick) => acc + tick.price, 0);
    return sum / period;
};

const calculateEMA = (data: number[], period: number): number[] => {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    const emaArray = [data.slice(0, period).reduce((a, b) => a + b, 0) / period];
    for (let i = period; i < data.length; i++) {
        emaArray.push(data[i] * k + emaArray[emaArray.length - 1] * (1 - k));
    }
    return emaArray;
};

const calculateRSI = (data: { price: number }[], period = 14) => {
    if (data.length < period + 1) return null;

    const prices = data.map(d => d.price);
    let gains = 0;
    let losses = 0;
    
    // Initial Average
    for (let i = prices.length - period; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) {
            gains += difference;
        } else {
            losses -= difference;
        }
    }

    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
};

const calculateStochastic = (data: CandleData[], period = 14) => {
    if (data.length < period) return null;

    const relevantData = data.slice(-period);
    const lowestLow = Math.min(...relevantData.map(d => d.low));
    const highestHigh = Math.max(...relevantData.map(d => d.high));
    const currentClose = relevantData[relevantData.length - 1].close;

    if (highestHigh === lowestLow) return 50;

    return 100 * ((currentClose - lowestLow) / (highestHigh - lowestLow));
};

const calculateBollingerBands = (data: { price: number }[], period = 20, stdDev = 2) => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const prices = relevantData.map(d => d.price);
    const middle = prices.reduce((a, b) => a + b, 0) / period;
    const variance = prices.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
    const deviation = Math.sqrt(variance);
    return {
        upper: middle + stdDev * deviation,
        middle: middle,
        lower: middle - stdDev * deviation,
    };
};

const calculateMACD = (data: { price: number }[], fast = 12, slow = 26, signal = 9) => {
    if (data.length < slow) return null;
    const prices = data.map(d => d.price);
    const emaFast = calculateEMA(prices, fast);
    const emaSlow = calculateEMA(prices, slow);
    const macdLine = emaFast.slice(-emaSlow.length).map((val, i) => val - emaSlow[i]);
    const signalLine = calculateEMA(macdLine, signal);
    
    if (macdLine.length === 0 || signalLine.length === 0) return null;
    
    return {
        macd: macdLine[macdLine.length - 1],
        signal: signalLine[signalLine.length - 1],
    };
};

const detectPriceActionPattern = (data: CandleData[]): string | null => {
    if (data.length < 2) return null;
    const lastCandle = data[data.length - 1];
    const { open, high, low, close } = lastCandle;

    const body = Math.abs(open - close);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;

    // Hammer Pattern (Bullish Reversal)
    if (lowerWick > body * 2 && upperWick < body) {
        return 'hammer';
    }
    // Shooting Star (Bearish Reversal)
    if (upperWick > body * 2 && lowerWick < body) {
        return 'shooting_star';
    }

    return null;
};

const calculateADX = (data: CandleData[], period = 14) => {
    if (data.length < period * 2) return null;

    const trs = [];
    const plusDMs = [];
    const minusDMs = [];

    for (let i = 1; i < data.length; i++) {
        const c = data[i];
        const p = data[i - 1];
        const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
        trs.push(tr);

        const upMove = c.high - p.high;
        const downMove = p.low - c.low;

        plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    
    const smoothedTR = calculateEMA(trs, period);
    const smoothedPlusDM = calculateEMA(plusDMs, period);
    const smoothedMinusDM = calculateEMA(minusDMs, period);
    
    if (smoothedTR.length === 0) return null;

    const plusDIs = smoothedPlusDM.map((val, i) => 100 * (val / smoothedTR[i]));
    const minusDIs = smoothedMinusDM.map((val, i) => 100 * (val / smoothedTR[i]));

    const dxs = plusDIs.map((plusDI, i) => (plusDI + minusDIs[i] === 0) ? 0 : 100 * (Math.abs(plusDI - minusDIs[i]) / (plusDI + minusDIs[i])));
    
    const adx = calculateEMA(dxs, period);
    if (!adx || adx.length === 0) return null;
    return adx[adx.length - 1];
};

const calculateVolatility = (data: { price: number }[], period = 20): number => {
    if (data.length < period) return 0;
    const relevantData = data.slice(-period);
    const prices = relevantData.map(d => d.price);
    const mean = prices.reduce((a, b) => a + b, 0) / period;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    return Math.sqrt(variance);
};


export const DerivApiProvider = ({ children }: { children: ReactNode }) => {
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
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('3m');
  const [lastAutopilotLossSuggestion, setLastAutopilotLossSuggestion] = useState<string | null>(null);
  const [isAutopilotOn, setIsAutopilotOn] = useState(false);
  const [autopilotStrategy, setAutopilotStrategy] = useState<AutoTraderStrategyOutput | null>(null);
  const [geminiRequestCount, setGeminiRequestCount] = useState(0);
  const [dailyBalance, setDailyBalance] = useState(100);
  const [dailyTarget, setDailyTarget] = useState(50);
  
  const [isCouncilAutopilotOn, setIsCouncilAutopilotOn] = useState(false);
  const [strategyCouncil, setStrategyCouncil] = useState<RobotStrategy[]>([]);
  const [isFetchingCouncil, setIsFetchingCouncil] = useState(false);
  const [councilVotes, setCouncilVotes] = useState<{ [key: string]: 'RISE' | 'FALL' | 'HOLD' }>({});
  const [consensusThreshold, setConsensusThreshold] = useState(8);
  const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(false);
  const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
  
  // States for indicators
  const [currentRSI, setCurrentRSI] = useState<number | null>(null);
  const [currentStoch, setCurrentStoch] = useState<number | null>(null);
  const [currentMA, setCurrentMA] = useState<{ short: number | null, long: number | null }>({ short: null, long: null });
  const [currentBollingerBands, setBollingerBands] = useState<{ upper: number, middle: number, lower: number } | null>(null);
  const [currentMACD, setMACD] = useState<{ macd: number, signal: number } | null>(null);
  const [currentPriceAction, setPriceAction] = useState<string | null>(null);
  const [currentADX, setADX] = useState<number | null>(null);
  const [currentIchimoku, setCurrentIchimoku] = useState<{ inCloud: boolean, trend: 'bullish' | 'bearish' | 'neutral' } | null>(null);
  const [currentAwesomeOscillator, setAwesomeOscillator] = useState<number | null>(null);
  const [currentVolumePoc, setVolumePoc] = useState<number | null>(null);


  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const promisesRef = useRef<Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>>(new Map());
  
  const activeSubscriptionId = useRef<string | null>(null);
  const activeSymbolRef = useRef<string | null>(null);
  
  const strategyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const STRATEGY_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

  const councilExecutionRef = useRef({ isExecuting: false });

  const fetchStrategyCouncil = useCallback(async (durationUnit: DurationUnit) => {
    if (!activeSymbolRef.current) return;
    setIsFetchingCouncil(true);
    try {
      const historicalData = await getHistoricalDataFromApi(activeSymbolRef.current, undefined, 200);
       if(!historicalData || historicalData.length < 50) {
            throw new Error("Dados históricos insuficientes para formar o conselho.");
        }
      setGeminiRequestCount(prev => prev + 1);
      const result = await getStrategyCouncilAction({
        symbol: activeSymbolRef.current,
        balance: dailyBalance,
        currency: accountBalance.currency || 'USD',
        historicalDataJson: JSON.stringify(historicalData),
        durationUnit: durationUnit,
      });
      if (result.success) {
        setStrategyCouncil(result.success.council);
        toast({ title: "Conselho de Robôs Formado!", description: "As estratégias dos analistas foram definidas." });
      } else {
        throw new Error(result.error || "Erro desconhecido ao formar o conselho.");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao Formar Conselho", description: e.message });
      setStrategyCouncil([]);
    }
    setIsFetchingCouncil(false);
  }, [dailyBalance, accountBalance.currency, toast]);
  
  const updateRobotPerformance = useCallback((contractResult: any) => {
        if (!isCouncilAutopilotOn || strategyCouncil.length === 0) return;

        const profit = parseFloat(contractResult.profit);
        const tradeDirection = contractResult.longcode.includes('RISE') ? 'RISE' : 'FALL';
        
        const newPerformance: { [key: string]: RobotPerformance } = {};

        strategyCouncil.forEach(robot => {
            const vote = councilVotes[robot.id];
            if (!vote) return;

            const performanceId = robot.id;
            let currentStats = robotPerformance.find(p => p.id === performanceId) || {
                id: performanceId,
                strategy: robot,
                wins: 0,
                losses: 0,
                totalProfit: 0,
            };

            if (vote === tradeDirection) { // Robot voted correctly
                currentStats = { ...currentStats, wins: currentStats.wins + 1, totalProfit: currentStats.totalProfit + profit };
            } else if (vote !== 'HOLD') { // Robot voted incorrectly
                currentStats = { ...currentStats, losses: currentStats.losses + 1, totalProfit: currentStats.totalProfit - contractResult.buy_price };
            }
             newPerformance[performanceId] = currentStats;
        });

         const updatedPerformance = robotPerformance.map(p => newPerformance[p.id] || p);
         Object.values(newPerformance).forEach(p => {
            if (!updatedPerformance.find(up => up.id === p.id)) {
                updatedPerformance.push(p);
            }
        });

        setRobotPerformance(updatedPerformance);
        localStorage.setItem(ROBOT_PERFORMANCE_KEY, JSON.stringify(updatedPerformance));

  }, [isCouncilAutopilotOn, strategyCouncil, councilVotes, robotPerformance]);

  const handleLosingTrade = useCallback(async (losingContract: any, initiator: OperationInitiator) => {
    const isAutopilotTrade = initiator === 'Piloto' || initiator === 'Conselho';
    console.log(`[Loss Analyzer] Analyzing losing trade: ${losingContract.contract_id}, Initiator: ${initiator}`);
    const operation = operationsLog.find(op => op.id === losingContract.contract_id);
    if (!operation) return;

    try {
      const historicalData = await getHistoricalDataFromApi(operation.asset, undefined, 100);
      
      const analysisInput = {
        operation: JSON.stringify(operation),
        historicalDataJson: JSON.stringify(historicalData),
        activeStrategyJson: isAutopilotTrade ? JSON.stringify(autopilotStrategy) : undefined, 
      };
      
      setGeminiRequestCount(prev => prev + 1);
      const result = await analyzeTradeLossAction(analysisInput);

      if (result.success) {
         toast({
            title: `Análise da Perda: ${result.success.analysis}`,
            description: `Sugestão da IA: ${result.success.suggestion}`,
            variant: "destructive",
            duration: 10000,
         });
         
         if (isAutopilotTrade) {
            console.log(`[Feedback Loop] Storing suggestion for autopilot: "${result.success.suggestion}"`);
            setLastAutopilotLossSuggestion(result.success.suggestion);
             if (initiator === 'Conselho') {
                console.log("[Feedback Loop] Re-fetching council strategy due to loss.");
                fetchStrategyCouncil(operation.durationUnit);
             }
         }

      } else {
         throw new Error(result.error || "A IA não conseguiu analisar a operação.");
      }

    } catch (e) {
      console.error("[Loss Analyzer] Error analyzing trade:", e);
    }
  }, [operationsLog, toast, autopilotStrategy, fetchStrategyCouncil]);

  useEffect(() => {
    try {
      const storedDemoToken = localStorage.getItem(DERIV_DEMO_TOKEN_KEY);
      const storedRealToken = localStorage.getItem(DERIV_REAL_TOKEN_KEY);
      const storedAccountType = localStorage.getItem(DERIV_ACCOUNT_TYPE_KEY) as AccountType | null;
      const storedPerformance = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
      
      if (storedDemoToken) setDemoToken(storedDemoToken);
      if (storedRealToken) setRealToken(storedRealToken);
      if (storedAccountType) setAccountTypeState(storedAccountType);
      if (storedPerformance) setRobotPerformance(JSON.parse(storedPerformance));


    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    setIsLoading(false);
  }, []);
  
  const activeToken = accountType === 'demo' ? demoToken : realToken;

  const clearChartData = useCallback(() => {
    setChartData([]);
    setPriceTicks([]);
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
        throw new Error("A conexão com a Deriv API não está ativa.");
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

        const newActiveContract: ActiveContract = {
            contractId: buyResult.contract_id,
            entryTick: buyResult.entry_tick,
            entryTime: buyResult.entry_tick_time,
            initiator,
        };
        setActiveContracts(prev => [...prev, newActiveContract]);


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
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("[Deriv WS Provider] Cannot subscribe, WS not open or ready.");
        return;
    }
    
    activeSymbolRef.current = symbol;

    if (activeSubscriptionId.current) {
        const subIdToForget = activeSubscriptionId.current;
        const req_id = Date.now();
        const forgetPromise = new Promise((resolve, reject) => {
            promisesRef.current.set(String(req_id), { resolve, reject });
            ws.send(JSON.stringify({ "forget": subIdToForget, "req_id": req_id }));
        });
        
        try {
            await forgetPromise;
        } catch (error) {
           console.warn(`[Deriv WS Provider] Non-critical error forgetting subscription (ID: ${subIdToForget}):`, error);
        } finally {
            activeSubscriptionId.current = null;
        }
    }
    
    clearChartData();
    setIsChartLoading(true);
    setChartError(null);

    if (newTimePeriod === '1m') {
        console.log(`[Deriv WS Provider] Subscribing to ticks for ${symbol}`);
        ws.send(JSON.stringify({ "ticks_history": symbol, "end": "latest", "count": 500, "style": "ticks", "subscribe": 1 }));
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
    
}, [clearChartData]);
 
 const fetchAutopilotStrategy = useCallback(async () => {
    if (!isAutopilotOn || !activeSymbolRef.current) return;

    // Calculate PnL for the day
    const today = new Date().toDateString();
    const dailyPnL = operationsLog
        .filter(op => new Date(op.timestamp).toDateString() === today && op.status !== 'pending')
        .reduce((sum, op) => sum + (op.result || 0), 0);

    // Stop-loss check
    if (dailyBalance > 0 && dailyPnL <= -dailyBalance) {
        toast({
            title: "Piloto Automático Desligado",
            description: `Limite de perda diária de $${dailyBalance.toFixed(2)} atingido.`,
            variant: "destructive",
            duration: 10000,
        });
        setIsAutopilotOn(false);
        return;
    }
    
    // Profit target check
    if (dailyTarget > 0 && dailyPnL >= dailyTarget) {
         toast({
            title: "Piloto Automático Desligado",
            description: `Meta de lucro diário de $${dailyTarget.toFixed(2)} atingida!`,
            variant: "default",
            className: "bg-green-600 text-white",
            duration: 10000,
        });
        setIsAutopilotOn(false);
        return;
    }


    console.log("[Autopilot] Fetching new strategy...");
    try {
        const historicalData = await getHistoricalDataFromApi(activeSymbolRef.current, undefined, 200);
        if(!historicalData || historicalData.length < 50) {
            console.warn("[Autopilot] Not enough price data to define a strategy.");
            return;
        }
        
        setGeminiRequestCount(prev => prev + 1);
        const result = await getAutotraderStrategyAction({
            symbol: activeSymbolRef.current,
            balance: dailyBalance,
            currency: accountBalance.currency || 'USD',
            stake: 10,
            duration: 5,
            durationUnit: 't',
            recentTrades: operationsLog.slice(0, 5),
            historicalData: historicalData,
            lastLossAnalysisSuggestion: lastAutopilotLossSuggestion ?? undefined,
        });

        if (result.success) {
            setAutopilotStrategy(result.success);
            toast({ title: "Nova Estratégia do Piloto Automático", description: result.success.justification });
            setLastAutopilotLossSuggestion(null);
        } else {
            throw new Error(result.error || "Ocorreu um erro desconhecido ao buscar estratégia.");
        }
    } catch (e: any) {
       console.error("[Autopilot] Error fetching strategy:", e.message);
       setAutopilotStrategy(null);
    }
  }, [isAutopilotOn, lastAutopilotLossSuggestion, dailyBalance, dailyTarget, accountBalance.currency, operationsLog, toast, setIsAutopilotOn]);

    
  const handleAutopilotCheck = useCallback(() => {
        if (!isAutopilotOn || priceTicks.length < 20) return;

        const lastTicks = priceTicks.slice(-100);
        const prices = lastTicks.map(t => t.price);
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const currentPrice = prices[prices.length - 1];
        const VOLATILITY_THRESHOLD = currentPrice * 0.0005;

        if (maxPrice - minPrice > VOLATILITY_THRESHOLD) {
            console.log(`[Autopilot] Volatility detected. Fetching new strategy.`);
            toast({
                title: "Piloto Automático",
                description: "Volatilidade detetada. A reavaliar a estratégia.",
            });
            fetchAutopilotStrategy();
        }
    }, [isAutopilotOn, priceTicks, fetchAutopilotStrategy, toast]);

    
  useEffect(() => {
    if (isAutopilotOn) {
        fetchAutopilotStrategy(); 
        if(strategyIntervalRef.current) clearInterval(strategyIntervalRef.current);
        strategyIntervalRef.current = setInterval(handleAutopilotCheck, STRATEGY_REFRESH_INTERVAL);
    } else {
        if (strategyIntervalRef.current) {
            clearInterval(strategyIntervalRef.current);
            strategyIntervalRef.current = null;
        }
    }
    return () => {
        if (strategyIntervalRef.current) {
            clearInterval(strategyIntervalRef.current);
        }
    };
  }, [isAutopilotOn, fetchAutopilotStrategy, handleAutopilotCheck]);


  // Turn off autopilot if connection is lost
  useEffect(() => {
      if(!isConnected && isAutopilotOn) {
          setIsAutopilotOn(false);
          toast({ variant: "destructive", title: "Piloto Automático Desativado", description: "A conexão com a corretora foi perdida." });
      }
  }, [isConnected, isAutopilotOn, toast, setIsAutopilotOn]);


  useEffect(() => {
    if (isAutopilotOn) {
        // This effect is for execution based on indicators, which we will handle in council
    }
  }, [isAutopilotOn, currentRSI, currentStoch]);
  
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
        if (!isConnected) { 
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
      const isForgetError = !!response.echo_req?.forget;

      if (response.error) {
        if (isForgetError) {
          const reqId = response.req_id;
          if (reqId && promisesRef.current.has(String(reqId))) {
            promisesRef.current.get(String(reqId))?.resolve(response); // Resolve even on forget error
            promisesRef.current.delete(String(reqId));
          }
          // Do not log forget errors
          return;
        }
        
        const isAlreadySubscribedError = response.error.code === 'AlreadySubscribed';
        if (response.msg_type === 'ticks_history' || response.msg_type === 'candles') {
          if (isAlreadySubscribedError) {
             console.warn(`[Deriv WS Provider] Already subscribed to ${response.echo_req?.ticks_history || 'unknown'}. Ignoring error.`);
             activeSubscriptionId.current = response.subscription?.id || null;
             return; // Ignore this error
          }
          
          console.error(`[Deriv WS Provider] Chart Data Error for ${response.echo_req?.ticks_history}:`, response.error.message);
          setChartError(response.error.message);
          setIsChartLoading(false);
          return;
        }
       
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
          return;
      }

      if (response.msg_type === 'authorize') {
        console.log("[Deriv WS Provider] Authorized successfully.");
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        ws.send(JSON.stringify({ "balance": 1, "subscribe": 1 }));
        ws.send(JSON.stringify({ "proposal_open_contract": 1, "subscribe": 1 }));
        if (!activeSymbolRef.current) {
            activeSymbolRef.current = '1HZ100V';
        }
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
          const isLoss = profit < 0;

          const profitLossMessage = profit >= 0 ? `Lucro de ${contract.currency} ${profit.toFixed(2)}` : `Prejuízo de ${contract.currency} ${Math.abs(profit).toFixed(2)}`;

          toast({
              title: "Negociação Encerrada",
              description: `Contrato ${contract.contract_id}: ${profitLossMessage}`,
              variant: isLoss ? "destructive" : "default",
          });

           const updatedLog = operationsLog.map(op =>
                op.id === contract.contract_id
                  ? { ...op, status: profit >= 0 ? 'won' : 'lost', result: profit }
                  : op
              );
            setOperationsLog(updatedLog);
          
          const activeContract = activeContracts.find(c => c.contractId === contract.contract_id);
          setActiveContracts(prev => prev.map(c => 
            c.contractId === contract.contract_id 
              ? { ...c, status: profit >= 0 ? 'won' : 'lost', exitTick: parseFloat(contract.exit_tick_display_value), exitTime: contract.exit_tick_time }
              : c
          ));
          
          if(activeContract?.initiator === 'Conselho') {
              updateRobotPerformance(contract);
          }


          if (isLoss && activeContract) {
            const initiator = activeContract.initiator;
            const autopilotTrades = updatedLog.filter(op => op.initiator !== 'Manual' && op.status !== 'pending');
            
            if (initiator === 'Piloto' || initiator === 'Conselho') {
                const recentAutopilotLosses = autopilotTrades
                    .slice(0, 2)
                    .filter(op => op.status === 'lost');

                if (recentAutopilotLosses.length >= 2) {
                     toast({
                        title: `Alerta do ${initiator}`,
                        description: "Duas perdas consecutivas detectadas. Forçando reavaliação da estratégia.",
                        variant: "destructive",
                     });
                     
                     handleLosingTrade(contract, initiator).then(() => {
                         if (initiator === 'Conselho') {
                            const lastOp = updatedLog.find(op => op.id === contract.contract_id);
                            if(lastOp) fetchStrategyCouncil(lastOp.durationUnit);
                         } else {
                            fetchAutopilotStrategy();
                         }
                     });
                } else {
                    handleLosingTrade(contract, initiator);
                }
            } else {
                 handleLosingTrade(contract, initiator);
            }
          }


          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ "balance": 1 }));
          }
      } else if (response.msg_type === 'tick') {
        if (response.subscription?.id && response.subscription.id === activeSubscriptionId.current) {
            const tick = response.tick;
            const newTick = { epoch: tick.epoch, price: tick.quote };
            setPriceTicks(prevTicks => [...prevTicks.slice(-499), newTick]);
            if(timePeriod === '1m') {
                setChartData(prev => [...(prev as TickData[]).slice(-499), newTick]);
            }
        }
      } else if (response.msg_type === 'ohlc') {
         if (response.subscription?.id && response.subscription.id === activeSubscriptionId.current) {
            const candle = response.ohlc;
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
                    const newData = [...data];
                    newData[data.length - 1] = newCandle;
                    return newData;
                } else {
                    return [...data.slice(-499), newCandle];
                }
            });
         }
      } else if (response.msg_type === 'candles') {
        activeSubscriptionId.current = response.subscription.id;
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
          activeSubscriptionId.current = response.subscription.id;
          const historyData = response.history.prices.map((price: number, index: number) => ({
              epoch: response.history.times[index],
              price: price,
          }));
          setChartData(historyData);
          setPriceTicks(historyData);
          setIsChartLoading(false);
      } else if (response.msg_type === 'forget') {
        const reqId = response.req_id;
        if (reqId && promisesRef.current.has(String(reqId))) {
            promisesRef.current.get(String(reqId))?.resolve(response);
            promisesRef.current.delete(String(reqId));
        }
        console.log(`[Deriv WS Provider] Successfully forgot subscription.`);
      }
    };


    return () => {
      // Cleanup logic if needed when dependencies change
    };
  }, [activeToken, isLoading, isConnected, toast, handleLosingTrade, timePeriod, activeContracts, operationsLog, fetchAutopilotStrategy, executeTrade, isAutopilotOn, setIsAutopilotOn, subscribeToSymbol, fetchStrategyCouncil, updateRobotPerformance]);


 useEffect(() => {
    const priceDataSource: { price: number }[] = priceTicks.length > 0 ? priceTicks : (chartData as CandleData[]).filter(d => 'close' in d).map(c => ({ price: c.close }));
    const candleDataSource: CandleData[] = chartData.filter(d => 'open' in d) as CandleData[];

    if (priceDataSource.length > 1) {
        setCurrentRSI(calculateRSI(priceDataSource));
        setBollingerBands(calculateBollingerBands(priceDataSource));
        setMACD(calculateMACD(priceDataSource));
        
        const maRobot = strategyCouncil.find(r => r.strategyType === 'MOVING_AVERAGE_CROSS');
        if (maRobot && maRobot.strategyType === 'MOVING_AVERAGE_CROSS' && priceDataSource.length > maRobot.longPeriod!) {
            setCurrentMA({
                short: calculateMA(priceDataSource, maRobot.shortPeriod!),
                long: calculateMA(priceDataSource, maRobot.longPeriod!)
            });
        }
    }

    if (candleDataSource.length > 1) {
        setPriceAction(detectPriceActionPattern(candleDataSource));
        setADX(calculateADX(candleDataSource));
        setCurrentStoch(calculateStochastic(candleDataSource));
    } else {
        setPriceAction(null);
        setADX(null);
        setCurrentStoch(null);
    }
}, [chartData, priceTicks, timePeriod, strategyCouncil]);

  
  // Dynamic Consensus Logic
  useEffect(() => {
    if (!isDynamicConsensusOn || !isCouncilAutopilotOn) return;

    const priceDataSource: { price: number }[] = priceTicks.length > 0 ? priceTicks : (chartData as CandleData[]).filter(d => 'close' in d).map(c => ({ price: c.close }));
    if (priceDataSource.length < 20) return;

    const volatility = calculateVolatility(priceDataSource, 20);
    const price = priceDataSource[priceDataSource.length - 1].price;
    const normalizedVolatility = (volatility / price) * 100; // Volatility as a percentage of price
    
    let newThreshold = 8;
    if (normalizedVolatility > 0.05) { // High volatility
      newThreshold = 7;
    } else if (normalizedVolatility < 0.01) { // Low volatility
      newThreshold = 9;
    }
    
    if (newThreshold !== consensusThreshold) {
      setConsensusThreshold(newThreshold);
      toast({ title: "Consenso Dinâmico", description: `Volatilidade detetada. Novo consenso: ${newThreshold} de 10.` });
    }

  }, [priceTicks, chartData, isDynamicConsensusOn, isCouncilAutopilotOn, consensusThreshold, setConsensusThreshold, toast]);


  // Council voting and execution logic
  useEffect(() => {
    if (!isCouncilAutopilotOn || strategyCouncil.length === 0 || councilExecutionRef.current.isExecuting) return;

    const newVotes: { [key: string]: 'RISE' | 'FALL' | 'HOLD' } = {};
    let riseVotes = 0;
    let fallVotes = 0;

    for (const robot of strategyCouncil) {
      let vote: 'RISE' | 'FALL' | 'HOLD' = 'HOLD';
      switch (robot.strategyType) {
        case 'RSI':
          if (currentRSI && robot.strategyType === 'RSI') {
            if (currentRSI <= robot.buyThreshold!) vote = 'RISE';
            else if (currentRSI >= robot.sellThreshold!) vote = 'FALL';
          }
          break;
        case 'STOCHASTIC':
          if (currentStoch && robot.strategyType === 'STOCHASTIC') {
            if (currentStoch <= robot.buyThreshold!) vote = 'RISE';
            else if (currentStoch >= robot.sellThreshold!) vote = 'FALL';
          }
          break;
        case 'MOVING_AVERAGE_CROSS':
          if (currentMA.short && currentMA.long) {
            if (currentMA.short > currentMA.long) vote = 'RISE';
            else if (currentMA.short < currentMA.long) vote = 'FALL';
          }
          break;
        case 'BOLLINGER_BANDS':
            if (currentBollingerBands && priceTicks.length > 0) {
                const currentPrice = priceTicks[priceTicks.length - 1].price;
                if (currentPrice <= currentBollingerBands.lower) vote = 'RISE';
                else if (currentPrice >= currentBollingerBands.upper) vote = 'FALL';
            }
            break;
        case 'MACD_CROSS':
            if (currentMACD) {
                if (currentMACD.macd > currentMACD.signal) vote = 'RISE';
                else if (currentMACD.macd < currentMACD.signal) vote = 'FALL';
            }
            break;
        case 'PRICE_ACTION_PATTERN':
            if (currentPriceAction && robot.strategyType === 'PRICE_ACTION_PATTERN') {
                if (currentPriceAction === 'hammer' && robot.pattern === 'hammer') vote = 'RISE';
                else if (currentPriceAction === 'shooting_star' && robot.pattern === 'shooting_star') vote = 'FALL';
            }
            break;
        case 'ADX_TREND':
            if (currentADX && currentMA.short && currentMA.long && robot.strategyType === 'ADX_TREND') {
                if (currentADX > robot.trendStrengthThreshold!) {
                    if (currentMA.short > currentMA.long) vote = 'RISE';
                    else if (currentMA.short < currentMA.long) vote = 'FALL';
                }
            }
            break;
      }
      newVotes[robot.id] = vote;
      if (vote === 'RISE') riseVotes++;
      if (vote === 'FALL') fallVotes++;
    }
    setCouncilVotes(newVotes);

    if (riseVotes >= consensusThreshold || fallVotes >= consensusThreshold) {
      councilExecutionRef.current.isExecuting = true;
      const direction = riseVotes >= consensusThreshold ? 'rise' : 'fall';
      const firstRobot = strategyCouncil[0];
      const stake = firstRobot.suggestedStake;
      const duration = firstRobot.suggestedDuration;
      const unit = firstRobot.suggestedDurationUnit;

      toast({
        title: "Consenso do Conselho!",
        description: `Executando ordem de ${direction.toUpperCase()} com Aposta: $${stake.toFixed(2)} e Duração: ${duration} ${unit}.`
      });

      executeTrade('CALL', stake, activeSymbolRef.current!, direction, duration, unit, 'Conselho')
        .finally(() => {
          setTimeout(() => {
            councilExecutionRef.current.isExecuting = false;
          }, 10000); // Cooldown period
        });
    }
  }, [
      isCouncilAutopilotOn,
      strategyCouncil,
      consensusThreshold,
      currentRSI, 
      currentStoch, 
      currentMA, 
      currentBollingerBands, 
      currentMACD,
      currentPriceAction,
      currentADX,
      executeTrade, 
      priceTicks,
      toast
  ]);


 // Stop-loss and profit-target logic for both autopilots
  useEffect(() => {
    const today = new Date().toDateString();
    const dailyPnL = operationsLog
        .filter(op => new Date(op.timestamp).toDateString() === today && op.status !== 'pending')
        .reduce((sum, op) => sum + (op.result || 0), 0);

    if (isAutopilotOn && dailyBalance > 0 && dailyPnL <= -dailyBalance) {
        toast({
            title: "Piloto Automático Desligado",
            description: `Limite de perda diária de $${dailyBalance.toFixed(2)} atingido.`,
            variant: "destructive",
            duration: 10000,
        });
        setIsAutopilotOn(false);
    }
    
    if (isAutopilotOn && dailyTarget > 0 && dailyPnL >= dailyTarget) {
         toast({
            title: "Piloto Automático Desligado",
            description: `Meta de lucro diário de $${dailyTarget.toFixed(2)} atingida!`,
            variant: "default",
            className: "bg-green-600 text-white",
            duration: 10000,
        });
        setIsAutopilotOn(false);
    }

    if (isCouncilAutopilotOn && dailyBalance > 0 && dailyPnL <= -dailyBalance) {
        toast({
            title: "Conselho de Robôs Desligado",
            description: `Limite de perda diária de $${dailyBalance.toFixed(2)} atingido.`,
            variant: "destructive",
            duration: 10000,
        });
        setIsCouncilAutopilotOn(false);
    }
    
    if (isCouncilAutopilotOn && dailyTarget > 0 && dailyPnL >= dailyTarget) {
         toast({
            title: "Conselho de Robôs Desligado",
            description: `Meta de lucro diário de $${dailyTarget.toFixed(2)} atingida!`,
            variant: "default",
            className: "bg-green-600 text-white",
            duration: 10000,
        });
        setIsCouncilAutopilotOn(false);
    }

  }, [operationsLog, isAutopilotOn, isCouncilAutopilotOn, dailyBalance, dailyTarget, setIsAutopilotOn, setIsCouncilAutopilotOn, toast]);


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



  const clearActiveContracts = () => setActiveContracts([]);
  
  const addActiveContract = (contract: ActiveContract) => {
    setActiveContracts(prev => [...prev, contract]);
  }

  const getAnalysis = async (symbol: string): Promise<string> => {
    const closedOperations = operationsLog.filter(op => op.status !== 'pending' && op.asset === symbol);
    if(closedOperations.length === 0) {
        return "Não há operações concluídas suficientes para este ativo na sessão atual para fazer uma análise."
    }
    setGeminiRequestCount(prev => prev + 1);
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
    isAutopilotOn,
    setIsAutopilotOn,
    autopilotStrategy,
    fetchAutopilotStrategy,
    isCouncilAutopilotOn,
    setIsCouncilAutopilotOn,
    strategyCouncil,
    isFetchingCouncil,
    fetchStrategyCouncil,
    councilVotes,
    consensusThreshold,
    setConsensusThreshold,
    isDynamicConsensusOn,
    setIsDynamicConsensusOn,
    robotPerformance,
    currentRSI,
    currentStoch,
    currentMA,
    currentBollingerBands,
    currentMACD,
    currentPriceAction,
    currentADX,
    currentIchimoku,
    currentAwesomeOscillator,
    currentVolumePoc,
    geminiRequestCount,
    dailyBalance,
    setDailyBalance,
    dailyTarget,
    setDailyTarget,
    setChartType,
    setTimePeriod,
    refreshBalance,
    executeTrade,
    clearActiveContracts,
    addActiveContract,
    getAnalysis,
    subscribeToSymbol,
    clearChartData
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
