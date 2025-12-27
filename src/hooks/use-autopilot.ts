

'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { getAutotraderStrategyAction } from '@/app/actions/ai-actions';
import type { RiseFallFormValues } from "@/components/trading/deriv-trader-interface.types";
import type { AutoTraderStrategyOutput } from "@/ai/flows/auto-trader-strategy-flow.types";
import { useTradeAnalysis } from "./use-trade-analysis";
import { useDerivApi, type ApiHistoricalData } from "./use-deriv-api";

// Helper function to get historical data from the main hook
const getHistoricalDataFromApi = async (getFn: (symbol: string, style: 'ticks' | 'candles', count: number) => Promise<ApiHistoricalData[]>, symbol: string) => {
    return getFn(symbol, 'ticks', 200);
}

export function useAutopilot(
    indicators: { rsi: number | null, stoch: number | null },
    incrementRequestCount: () => void
) {
    const { operationsLog, addActiveContract, executeTrade, chartData, activeSymbol } = useDerivApi();
    const tradeAnalysis = useTradeAnalysis(activeSymbol, operationsLog, incrementRequestCount);
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();

    const [isAutopilotOn, setIsAutopilotOn] = useState(false);
    const [autopilotStrategy, setAutopilotStrategy] = useState<AutoTraderStrategyOutput | null>(null);
    const [lastAutopilotLossSuggestion, setLastAutopilotLossSuggestion] = useState<string | null>(null);
    const [dailyBalance, setDailyBalance] = useState(100);
    const [dailyTarget, setDailyTarget] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    
    const strategyIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const STRATEGY_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const fetchAutopilotStrategy = useCallback(async () => {
        if (!isAutopilotOn || !activeSymbol) return;

        console.log("[Autopilot] Fetching new strategy...");
        setIsLoading(true);
        setError(null);
        try {
            if (!chartData || chartData.length < 50) {
                throw new Error("Dados históricos insuficientes para definir a estratégia.");
            }
            const historicalDataForAI = chartData.map(item => ({
                date: new Date(item.epoch * 1000).toISOString(),
                price: 'price' in item ? item.price : item.close
            }));
            
            incrementRequestCount();
            const result = await getAutotraderStrategyAction({
                symbol: activeSymbol,
                balance: dailyBalance,
                currency: 'USD',
                stake: 10,
                duration: 5,
                durationUnit: 't',
                recentTrades: operationsLog.slice(0, 5),
                historicalData: historicalDataForAI,
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
      }, [isAutopilotOn, activeSymbol, dailyBalance, operationsLog, lastAutopilotLossSuggestion, toast, chartData, incrementRequestCount]);
    
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
            if (isExecuting || !isAutopilotOn || !autopilotStrategy || (indicators.rsi === null && indicators.stoch === null) || !activeSymbol) return;

            let conditionMet = false;
            if (autopilotStrategy.strategyName === 'RSI_BASIC' && autopilotStrategy.rsiThreshold && indicators.rsi !== null) {
                if (autopilotStrategy.direction === 'RISE' && indicators.rsi <= autopilotStrategy.rsiThreshold) conditionMet = true;
                else if (autopilotStrategy.direction === 'FALL' && indicators.rsi >= autopilotStrategy.rsiThreshold) conditionMet = true;
            } else if (autopilotStrategy.strategyName === 'STOCH_BASIC' && autopilotStrategy.stochThreshold && indicators.stoch !== null) {
                if (autopilotStrategy.direction === 'RISE' && indicators.stoch <= autopilotStrategy.stochThreshold) conditionMet = true;
                else if (autopilotStrategy.direction === 'FALL' && indicators.stoch >= autopilotStrategy.stochThreshold) conditionMet = true;
            }

            if (conditionMet) {
                setIsExecuting(true);
                const { allowEquals } = form.getValues();
                const { suggestedStake, suggestedDuration, direction } = autopilotStrategy;
                
                toast({ title: "Piloto Automático", description: `Condição de ${direction} atingida! Executando.` });
                
                let contractType = direction === 'RISE' ? (allowEquals ? 'CALLE' : 'CALL') : (allowEquals ? 'PUTE' : 'PUT');

                const result = await executeTrade(contractType, suggestedStake, activeSymbol, direction.toLowerCase() as 'rise' | 'fall', suggestedDuration, 't', 'Piloto');
                
                if (result.success && result.contractId && result.entryTick && result.entryTime) {
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
    }, [isAutopilotOn, isExecuting, autopilotStrategy, indicators, form, executeTrade, activeSymbol, toast, addActiveContract]);

    // Effect for risk management (stop loss/profit target)
    useEffect(() => {
        if (!isAutopilotOn || !operationsLog) return;

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
      if (!operationsLog || operationsLog.length === 0) return;
      const lastOp = operationsLog[0];
      if (lastOp && lastOp.status === 'lost' && lastOp.initiator === 'Piloto') {
          tradeAnalysis.analyzeLosingTrade(lastOp, autopilotStrategy).then(suggestion => {
              if (suggestion) {
                  setLastAutopilotLossSuggestion(suggestion);
              }
          });
      }
    }, [operationsLog, tradeAnalysis, autopilotStrategy]);

    return {
        isAutopilotOn,
        setIsAutopilotOn,
        autopilotStrategy,
        dailyBalance,
        setDailyBalance,
        dailyTarget,
        setDailyTarget,
        isLoading,
        error,
        currentRSI: indicators.rsi,
        currentStoch: indicators.stoch,
    };
}
