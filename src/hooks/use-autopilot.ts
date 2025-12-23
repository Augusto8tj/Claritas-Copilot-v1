
'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { useToast } from "@/hooks/use-toast";
import { getHistoricalData } from "@/services/deriv-api-service";
import { getAutotraderStrategyAction } from '@/app/actions/ai-actions';
import type { RiseFallFormValues } from "@/components/trading/deriv-trader-interface.types";
import type { AutoTraderStrategyOutput } from "@/ai/flows/auto-trader-strategy-flow.types";
import { useTradeAnalysis } from "./use-trade-analysis";
import type { ChartData } from "./use-market-data";
import type { Operation } from "@/components/trading/operations-log.types";

// Indicator Calculation Helpers
const calculateRSI = (data: { price: number }[], period = 14) => {
    if (data.length < period + 1) return null;
    const prices = data.map(d => d.price);
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) gains += difference;
        else losses -= difference;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
};

const calculateStochastic = (data: { high: number, low: number, close: number }[], period = 14) => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const lowestLow = Math.min(...relevantData.map(d => d.low));
    const highestHigh = Math.max(...relevantData.map(d => d.high));
    const currentClose = relevantData[relevantData.length - 1].close;
    if (highestHigh === lowestLow) return 50;
    return 100 * ((currentClose - lowestLow) / (highestHigh - lowestLow));
};

export function useAutopilot(
    activeSymbol: string | null,
    chartData: ChartData[],
    operationsLog: Operation[],
    addActiveContract: (contract: any) => void,
    executeTrade: any
) {
    const { isConnected } = useDerivApi();
    const { analyzeLosingTrade } = useTradeAnalysis(activeSymbol, operationsLog);
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();

    const [isAutopilotOn, setIsAutopilotOn] = useState(false);
    const [autopilotStrategy, setAutopilotStrategy] = useState<AutoTraderStrategyOutput | null>(null);
    const [lastAutopilotLossSuggestion, setLastAutopilotLossSuggestion] = useState<string | null>(null);
    const [geminiRequestCount, setGeminiRequestCount] = useState(0);
    const [dailyBalance, setDailyBalance] = useState(100);
    const [dailyTarget, setDailyTarget] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    const [currentRSI, setCurrentRSI] = useState<number | null>(null);
    const [currentStoch, setCurrentStoch] = useState<number | null>(null);
    
    const strategyIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const STRATEGY_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const fetchAutopilotStrategy = useCallback(async () => {
        if (!isAutopilotOn || !activeSymbol) return;

        console.log("[Autopilot] Fetching new strategy...");
        setIsLoading(true);
        setError(null);
        try {
            const historicalData = await getHistoricalData(activeSymbol, undefined, 200);
            if(!historicalData || historicalData.length < 50) {
                throw new Error("Dados históricos insuficientes para definir a estratégia.");
            }
            
            setGeminiRequestCount(prev => prev + 1);
            const result = await getAutotraderStrategyAction({
                symbol: activeSymbol,
                balance: dailyBalance,
                currency: 'USD',
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
           setError(e.message);
           setAutopilotStrategy(null);
        } finally {
            setIsLoading(false);
        }
      }, [isAutopilotOn, activeSymbol, dailyBalance, operationsLog, lastAutopilotLossSuggestion, toast]);
    
    // Effect for indicator calculation
    useEffect(() => {
        if (!chartData) return;
        const candleData = chartData.filter(d => 'close' in d) as { high: number, low: number, close: number, price: number }[];
        if (candleData.length > 14) {
            candleData.forEach(c => { c.price = c.close });
            setCurrentRSI(calculateRSI(candleData));
            setCurrentStoch(calculateStochastic(candleData));
        }
    }, [chartData]);
    
    // Effect to manage the strategy refresh interval
    useEffect(() => {
        if (isAutopilotOn) {
            fetchAutopilotStrategy(); 
            if (strategyIntervalRef.current) clearInterval(strategyIntervalRef.current);
            strategyIntervalRef.current = setInterval(fetchAutopilotStrategy, STRATEGY_REFRESH_INTERVAL);
        } else {
            if (strategyIntervalRef.current) {
                clearInterval(strategyIntervalRef.current);
                strategyIntervalRef.current = null;
            }
        }
        return () => {
            if (strategyIntervalRef.current) clearInterval(strategyIntervalRef.current);
        };
    }, [isAutopilotOn, fetchAutopilotStrategy]);
    
    // Effect to check and execute trades based on strategy
    useEffect(() => {
        const checkAndExecute = async () => {
            if (isExecuting || !isAutopilotOn || !autopilotStrategy || (currentRSI === null && currentStoch === null)) return;

            let conditionMet = false;
            if (autopilotStrategy.strategyName === 'RSI_BASIC' && autopilotStrategy.rsiThreshold && currentRSI !== null) {
                if (autopilotStrategy.direction === 'RISE' && currentRSI <= autopilotStrategy.rsiThreshold) conditionMet = true;
                else if (autopilotStrategy.direction === 'FALL' && currentRSI >= autopilotStrategy.rsiThreshold) conditionMet = true;
            } else if (autopilotStrategy.strategyName === 'STOCH_BASIC' && autopilotStrategy.stochThreshold && currentStoch !== null) {
                if (autopilotStrategy.direction === 'RISE' && currentStoch <= autopilotStrategy.stochThreshold) conditionMet = true;
                else if (autopilotStrategy.direction === 'FALL' && currentStoch >= autopilotStrategy.stochThreshold) conditionMet = true;
            }

            if (conditionMet) {
                setIsExecuting(true);
                const { allowEquals } = form.getValues();
                const { suggestedStake, suggestedDuration, direction } = autopilotStrategy;
                
                toast({ title: "Piloto Automático", description: `Condição de ${direction} atingida! Executando.` });
                
                let contractType = direction === 'RISE' ? (allowEquals ? 'CALLE' : 'CALL') : (allowEquals ? 'PUTE' : 'PUT');

                const result = await executeTrade(contractType, suggestedStake, activeSymbol!, direction.toLowerCase() as 'rise' | 'fall', suggestedDuration, 't', 'Piloto');
                
                if (result.success && result.contractId) {
                    addActiveContract({
                        contractId: result.contractId,
                        entryTick: result.entryTick,
                        entryTime: result.entryTime,
                        initiator: 'Piloto'
                    });
                }
                
                setTimeout(() => setIsExecuting(false), 10000); 
            }
        };

        checkAndExecute();
    }, [isAutopilotOn, isExecuting, autopilotStrategy, currentRSI, currentStoch, form, executeTrade, activeSymbol, toast, addActiveContract]);

    // Effect for risk management (stop loss/profit target)
    useEffect(() => {
        if (!isAutopilotOn) return;

        const today = new Date().toDateString();
        const dailyPnL = operationsLog
            .filter(op => op.initiator === 'Piloto' && new Date(op.timestamp).toDateString() === today && op.status !== 'pending')
            .reduce((sum, op) => sum + (op.result || 0), 0);

        if (dailyBalance > 0 && dailyPnL <= -dailyBalance) {
            toast({ title: "Piloto Automático Desligado", description: `Limite de perda diária atingido.`, variant: "destructive", duration: 10000 });
            setIsAutopilotOn(false);
        }
        
        if (dailyTarget > 0 && dailyPnL >= dailyTarget) {
            toast({ title: "Piloto Automático Desligado", description: `Meta de lucro diário atingida!`, className: "bg-green-600 text-white", duration: 10000 });
            setIsAutopilotOn(false);
        }
    }, [operationsLog, isAutopilotOn, dailyBalance, dailyTarget, toast]);
    
    // Effect to handle losing trades analysis
    useEffect(() => {
      if (operationsLog.length === 0) return;
      const lastOp = operationsLog[0];
      if (lastOp && lastOp.status === 'lost' && lastOp.initiator === 'Piloto') {
          analyzeLosingTrade(lastOp, autopilotStrategy).then(suggestion => {
              if (suggestion) {
                  setLastAutopilotLossSuggestion(suggestion);
              }
          });
      }
    }, [operationsLog, analyzeLosingTrade, autopilotStrategy]);

    // Turn off autopilot if connection is lost
    useEffect(() => {
        if(!isConnected && isAutopilotOn) {
            setIsAutopilotOn(false);
            toast({ variant: "destructive", title: "Piloto Automático Desativado", description: "A conexão com a corretora foi perdida." });
        }
    }, [isConnected, isAutopilotOn, toast]);

    return {
        isAutopilotOn,
        setIsAutopilotOn,
        autopilotStrategy,
        dailyBalance,
        setDailyBalance,
        dailyTarget,
        setDailyTarget,
        geminiRequestCount,
        isLoading,
        error,
        currentRSI,
        currentStoch,
    };
}
