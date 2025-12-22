

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
  councilVotes: { [key: string]: { vote: 'RISE' | 'FALL' | 'HOLD', confidence: number, weight: number } };
  consensusThreshold: number;
  setConsensusThreshold: (threshold: number) => void;
  isDynamicConsensusOn: boolean;
  setIsDynamicConsensusOn: (isOn: boolean) => void;
  isMeritocracyOn: boolean;
  setIsMeritocracyOn: (isOn: boolean) => void;
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
    let emaArray: number[] = [];
    if (data.length === period) {
        // Calculate the initial SMA for the first EMA value
        const initialSma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
        emaArray.push(initialSma);
    } else if (data.length > period) {
        // Assume data is already a series of EMAs for smoothing purposes, or a price series to start
        emaArray.push(data.slice(0, period).reduce((a, b) => a + b, 0) / period); // Initial SMA
        const k = 2 / (period + 1);
        for (let i = period; i < data.length; i++) {
            emaArray.push(data[i] * k + emaArray[emaArray.length - 1] * (1 - k));
        }
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

    const macdLine: number[] = [];
    const startOffset = emaFast.length - emaSlow.length;
    for (let i = 0; i < emaSlow.length; i++) {
        macdLine.push(emaFast[i + startOffset] - emaSlow[i]);
    }
    
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
    
    const validLength = Math.min(smoothedTR.length, smoothedPlusDM.length, smoothedMinusDM.length);
    const plusDIs = [];
    const minusDIs = [];

    for(let i = 0; i < validLength; i++) {
        if(smoothedTR[i] === 0) continue;
        plusDIs.push(100 * (smoothedPlusDM[i] / smoothedTR[i]));
        minusDIs.push(100 * (smoothedMinusDM[i] / smoothedTR[i]));
    }

    const dxs = plusDIs.map((plusDI, i) => (plusDI + minusDIs[i] === 0) ? 0 : 100 * (Math.abs(plusDI - minusDIs[i]) / (plusDI + minusDIs[i])));
    
    const adx = calculateEMA(dxs, period);
    if (!adx || adx.length === 0) return null;
    return adx[adx.length - 1];
};


const calculateIchimokuCloud = (data: CandleData[]) => {
    if (data.length < 52) return null;
    const lastData = data[data.length - 1];

    const tenkanSen = (Math.max(...data.slice(-9).map(d => d.high)) + Math.min(...data.slice(-9).map(d => d.low))) / 2;
    const kijunSen = (Math.max(...data.slice(-26).map(d => d.high)) + Math.min(...data.slice(-26).map(d => d.low))) / 2;
    const senkouSpanA = (tenkanSen + kijunSen) / 2;

    const pastDataForB = data.slice(-52, -26);
    const senkouSpanB = (Math.max(...pastDataForB.map(d => d.high)) + Math.min(...pastDataForB.map(d => d.low))) / 2;

    const inCloud = lastData.close > Math.min(senkouSpanA, senkouSpanB) && lastData.close < Math.max(senkouSpanA, senkouSpanB);
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (lastData.close > Math.max(senkouSpanA, senkouSpanB)) trend = 'bullish';
    if (lastData.close < Math.min(senkouSpanA, senkouSpanB)) trend = 'bearish';

    return { inCloud, trend };
};

const calculateAwesomeOscillator = (data: CandleData[]) => {
    if (data.length < 34) return null;

    const medianPrices = data.map(d => (d.high + d.low) / 2);
    
    const shortMAPeriod = 5;
    const longMAPeriod = 34;
    
    const shortMAData = medianPrices.slice(-shortMAPeriod);
    const longMAData = medianPrices.slice(-longMAPeriod);

    const ma5 = shortMAData.reduce((acc, p) => acc + p, 0) / shortMAPeriod;
    const ma34 = longMAData.reduce((acc, p) => acc + p, 0) / longMAPeriod;
    
    return ma5 - ma34;
};

const calculateVolumeProfile = (data: CandleData[], bars: number) => {
    if (data.length < bars) return null;
    
    const relevantData = data.slice(-bars);
    const priceLevels: { [key: string]: number } = {};

    relevantData.forEach(candle => {
        if (!candle.close || !candle.volume) return; 
        const priceStr = candle.close.toFixed(4);
        if (!priceLevels[priceStr]) {
            priceLevels[priceStr] = 0;
        }
        priceLevels[priceStr] += candle.volume; 
    });

    let poc = null;
    let maxVolume = 0;
    for (const price in priceLevels) {
        if (priceLevels[price] > maxVolume) {
            maxVolume = priceLevels[price];
            poc = parseFloat(price);
        }
    }
    return poc;
};


const calculateATR = (data: CandleData[], period = 14) => {
    if (data.length < period) return null;
    let trs = [];
    for (let i = data.length - period; i < data.length; i++) {
        const c = data[i];
        const p = data[i-1];
        if (!p) continue;
        const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
        trs.push(tr);
    }
    if (trs.length === 0) return null;
    const atr = trs.reduce((a, b) => a + b, 0) / trs.length;
    return atr;
}

const calculateOBV = (data: CandleData[]) => {
    if (data.length < 2) return null;
    let obv = 0;
    for (let i = 1; i < data.length; i++) {
        const c = data[i];
        const p = data[i-1];
        if (c.close > p.close) {
            obv += c.volume || 0;
        } else if (c.close < p.close) {
            obv -= c.volume || 0;
        }
    }
    return obv;
}


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
  const [councilVotes, setCouncilVotes] = useState<{ [key: string]: { vote: 'RISE' | 'FALL' | 'HOLD', confidence: number, weight: number } }>({});
  const [consensusThreshold, setConsensusThreshold] = useState(300);
  const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
  const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);
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
      setGeminiRequestCount(prev => prev + 10); // 10 requests for the council
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
            const voteData = councilVotes[robot.id];
            if (!voteData) return;

            const performanceId = robot.id;
            let currentStats = robotPerformance.find(p => p.id === performanceId) || {
                id: performanceId,
                strategy: robot,
                wins: 0,
                losses: 0,
                totalProfit: 0,
            };

            if (voteData.vote === tradeDirection) { // Robot voted correctly
                currentStats = { ...currentStats, wins: currentStats.wins + 1, totalProfit: currentStats.totalProfit + profit };
            } else if (voteData.vote !== 'HOLD') { // Robot voted incorrectly
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
         }

      } else {
         throw new Error(result.error || "A IA não conseguiu analisar a operação.");
      }

    } catch (e) {
      console.error("[Loss Analyzer] Error analyzing trade:", e);
    }
  }, [operationsLog, toast, autopilotStrategy]);

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
            subscribe: 1,
            adjust_start_time: 1 // Crucial para obter dados de volume
        }));
    }
    
}, [clearChartData]);
 
 const fetchAutopilotStrategy = useCallback(async () => {
    if (!isAutopilotOn || !activeSymbolRef.current) return;

    // Risk management checks are now handled in the main useEffect
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
            setLastAutopilotLossSuggestion(null); // Clear suggestion after using it
        } else {
            throw new Error(result.error || "Ocorreu um erro desconhecido ao buscar estratégia.");
        }
    } catch (e: any) {
       console.error("[Autopilot] Error fetching strategy:", e.message);
       setAutopilotStrategy(null);
    }
  }, [isAutopilotOn, lastAutopilotLossSuggestion, dailyBalance, accountBalance.currency, operationsLog, toast]);

    
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
            handleLosingTrade(contract, activeContract.initiator);
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
                volume: parseFloat(candle.volume),
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
            volume: candle.volume,
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
        if (maRobot && maRobot.shortPeriod && maRobot.longPeriod && priceDataSource.length > maRobot.longPeriod) {
            setCurrentMA({
                short: calculateMA(priceDataSource, maRobot.shortPeriod),
                long: calculateMA(priceDataSource, maRobot.longPeriod)
            });
        }
    }

    if (candleDataSource.length > 1) {
        setPriceAction(detectPriceActionPattern(candleDataSource));
        setADX(calculateADX(candleDataSource));
        setCurrentStoch(calculateStochastic(candleDataSource));
        setCurrentIchimoku(calculateIchimokuCloud(candleDataSource));
        setAwesomeOscillator(calculateAwesomeOscillator(candleDataSource));
        
        const volumeRobot = strategyCouncil.find(r => r.strategyType === 'VOLUME_PROFILE');
        if (volumeRobot && volumeRobot.profileBars) {
            setVolumePoc(calculateVolumeProfile(candleDataSource, volumeRobot.profileBars));
        }
    } else {
        setPriceAction(null);
        setADX(null);
        setCurrentStoch(null);
        setCurrentIchimoku(null);
        setAwesomeOscillator(null);
        setVolumePoc(null);
    }
}, [chartData, priceTicks, timePeriod, strategyCouncil]);

  
  // Dynamic Consensus Logic
  useEffect(() => {
    if (!isDynamicConsensusOn || !isCouncilAutopilotOn) return;

    const priceDataSource: { price: number }[] = priceTicks.length > 0 ? priceTicks : (chartData as CandleData[]).filter(d => 'close' in d).map(c => ({ price: c.close }));
    if (priceDataSource.length < 20) return;

    const volatility = calculateVolatility(priceDataSource, 20);
    const price = priceDataSource[priceDataSource.length - 1].price;
    if (price === 0) return;

    const normalizedVolatility = (volatility / price) * 100; // Volatility as a percentage of price
    
    let newThreshold = 400; // Default
    if (normalizedVolatility > 0.05) { // High volatility
      newThreshold = 500;
    } else if (normalizedVolatility < 0.01) { // Low volatility / strong trend
      newThreshold = 300;
    }
    
    if (newThreshold !== consensusThreshold) {
      setConsensusThreshold(newThreshold);
      toast({ title: "Consenso Dinâmico", description: `Volatilidade detetada. Novo limiar de consenso: ${newThreshold}.` });
    }

  }, [priceTicks, chartData, isDynamicConsensusOn, isCouncilAutopilotOn, consensusThreshold, setConsensusThreshold, toast]);


  // Council voting and execution logic
  useEffect(() => {
    if (!isCouncilAutopilotOn || strategyCouncil.length === 0 || councilExecutionRef.current.isExecuting) return;

    const newVotes: { [key: string]: { vote: 'RISE' | 'FALL' | 'HOLD', confidence: number, weight: number } } = {};
    let riseConfidenceSum = 0;
    let fallConfidenceSum = 0;

    for (const robot of strategyCouncil) {
        let vote: 'RISE' | 'FALL' | 'HOLD' = 'HOLD';
        let confidence = 0;
        let weight = 1.0; 

        if (isMeritocracyOn) {
            const performance = robotPerformance.find(p => p.id === robot.id);
            if (performance) {
                const totalTrades = performance.wins + performance.losses;
                if (totalTrades > 5) {
                    const winRate = performance.wins / totalTrades;
                    weight = 0.5 + winRate; 
                }
            }
        }
        
      switch (robot.strategyType) {
        case 'RSI':
          if (currentRSI && robot.strongBuyThreshold && robot.weakBuyThreshold && robot.strongSellThreshold && robot.weakSellThreshold) {
            if (currentRSI <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
            else if (currentRSI <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
            else if (currentRSI >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
            else if (currentRSI >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
          }
          break;
        case 'STOCHASTIC':
          if (currentStoch && robot.strongBuyThreshold && robot.weakBuyThreshold && robot.strongSellThreshold && robot.weakSellThreshold) {
            if (currentStoch <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
            else if (currentStoch <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
            else if (currentStoch >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
            else if (currentStoch >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
          }
          break;
        // ... other robot strategies will follow the same pattern ...
      }
      
      newVotes[robot.id] = { vote, confidence, weight };
      if (vote === 'RISE') riseConfidenceSum += confidence * weight;
      if (vote === 'FALL') fallConfidenceSum += confidence * weight;
    }
    setCouncilVotes(newVotes);

    const today = new Date().toDateString();
    const dailyPnL = operationsLog
        .filter(op => new Date(op.timestamp).toDateString() === today && op.status !== 'pending')
        .reduce((sum, op) => sum + (op.result || 0), 0);

    const direction = riseConfidenceSum > fallConfidenceSum ? 'rise' : 'fall';
    const consensusReached = Math.max(riseConfidenceSum, fallConfidenceSum) >= consensusThreshold;
    
    if (consensusReached) {
        // --- Risk Analyst Veto Logic ---
        const lastTwoCouncilTrades = operationsLog.filter(op => op.initiator === 'Conselho').slice(0, 2);
        const hasLossStreak = lastTwoCouncilTrades.length === 2 && lastTwoCouncilTrades.every(op => op.status === 'lost');

        if (dailyTarget > 0 && dailyPnL >= dailyTarget * 0.8) {
            toast({ title: "Analista de Risco (VETO)", description: "Meta de lucro quase atingida. Bloqueando novas operações para proteger ganhos." });
            return;
        }
        if (hasLossStreak) {
            toast({ title: "Analista de Risco (VETO)", description: "Série de perdas detetada. Pausando operações para reavaliação.", variant: "destructive" });
            return;
        }
        // --- End of Veto Logic ---

      councilExecutionRef.current.isExecuting = true;
      const contractType = direction === 'rise' ? 'CALL' : 'PUT';
      const firstRobot = strategyCouncil[0];
      const stake = firstRobot.suggestedStake;
      const duration = firstRobot.suggestedDuration;
      const unit = firstRobot.suggestedDurationUnit;

      toast({
        title: "Consenso do Conselho!",
        description: `Executando ordem de ${direction.toUpperCase()} com confiança total de ${Math.max(riseConfidenceSum, fallConfidenceSum).toFixed(0)}.`
      });

      executeTrade(contractType, stake, activeSymbolRef.current!, direction, duration, unit, 'Conselho')
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
      isMeritocracyOn,
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
      executeTrade, 
      priceTicks,
      toast,
      operationsLog,
      dailyTarget
  ]);


 // Stop-loss and profit-target logic for both autopilots
  useEffect(() => {
    if (!isCouncilAutopilotOn && !isAutopilotOn) return;

    const today = new Date().toDateString();
    const dailyPnL = operationsLog
        .filter(op => new Date(op.timestamp).toDateString() === today && op.status !== 'pending')
        .reduce((sum, op) => sum + (op.result || 0), 0);

    const checkAndStop = (autopilotName: 'Piloto Automático' | 'Conselho de Robôs', turnOff: () => void) => {
        if (dailyBalance > 0 && dailyPnL <= -dailyBalance) {
            toast({
                title: `${autopilotName} Desligado`,
                description: `Limite de perda diária de $${dailyBalance.toFixed(2)} atingido.`,
                variant: "destructive",
                duration: 10000,
            });
            turnOff();
        }
        
        if (dailyTarget > 0 && dailyPnL >= dailyTarget) {
            toast({
                title: `${autopilotName} Desligado`,
                description: `Meta de lucro diário de $${dailyTarget.toFixed(2)} atingida!`,
                variant: "default",
                className: "bg-green-600 text-white",
                duration: 10000,
            });
            turnOff();
        }
    };

    if (isAutopilotOn) checkAndStop('Piloto Automático', () => setIsAutopilotOn(false));
    if (isCouncilAutopilotOn) checkAndStop('Conselho de Robôs', () => setIsCouncilAutopilotOn(false));

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
    isMeritocracyOn,
    setIsMeritocracyOn,
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
