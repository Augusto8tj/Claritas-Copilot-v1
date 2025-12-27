

'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { getAutotraderStrategyAction } from '@/app/actions/ai-actions';
import type { RiseFallFormValues } from "@/components/trading/deriv-trader-interface.types";
import type { AutoTraderStrategyOutput } from "@/ai/flows/auto-trader-strategy-flow.types";
import { useTradeAnalysis } from "./use-trade-analysis";
import { useDerivApi, type ChartData } from "./use-deriv-api";

export function useAutopilot(
    activeSymbol: string | null,
    incrementRequestCount: () => void
) {
    const { operationsLog, addActiveContract, executeTrade, chartData } = useDerivApi();
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
    
    // This hook no longer calculates indicators itself. It relies on them being passed or fetched elsewhere.
    // For this implementation, we'll assume the council's indicators are the source of truth if needed.
    // Or, for simplicity, we can make the autopilot dumber and not dependent on live indicators.
    // Let's refactor to make it fully independent and based only on its fetched strategy.

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
                setLastAutopilotLossSuggestion(null);
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
    
    // Autopilot execution logic is simplified as it doesn't have direct indicator access anymore.
    // This is a placeholder; a more robust implementation would need indicator data.
    useEffect(() => {
        // This effect is currently disabled as the hook doesn't receive live indicators.
        // The responsibility for execution now lies fully with the `useRobotCouncil` hook.
    }, [isAutopilotOn, isExecuting, autopilotStrategy, form, executeTrade, activeSymbol, toast, addActiveContract]);

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
        // Removed geminiRequestCount from here as it's managed by the council
    };
}
