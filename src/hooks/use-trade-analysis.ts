

'use client';

import { useState, useCallback } from 'react';
import { analyzeOperationsAction } from '@/app/actions/trading-actions';
import { analyzeTradeLossAction } from '@/app/actions/ai-actions';
import type { Operation } from '@/components/trading/operations-log.types';
import type { AutoTraderStrategyOutput } from "@/ai/flows/auto-trader-strategy-flow.types";
import { useToast } from './use-toast';
import { useDerivApi, type ApiHistoricalData } from './use-deriv-api';


const getHistoricalDataFromApi = async (getFn: (symbol: string, style: 'ticks' | 'candles', count: number) => Promise<ApiHistoricalData[]>, symbol: string) => {
    return getFn(symbol, 'ticks', 100);
}

export function useTradeAnalysis(
    activeSymbol: string | null,
    operationsLog: Operation[],
    incrementRequestCount: () => void,
) {
    const { chartData } = useDerivApi();
    const { toast } = useToast();
    
    const analyzeSessionPerformance = useCallback(async (): Promise<string> => {
        if (!activeSymbol) return "Erro: Nenhum ativo selecionado.";
        
        const closedOperations = operationsLog.filter(op => op.status !== 'pending' && op.asset === activeSymbol);
        if(closedOperations.length === 0) {
            return "Não há operações concluídas suficientes para este ativo na sessão atual para fazer uma análise."
        }

        incrementRequestCount();
        const response = await analyzeOperationsAction({ operations: closedOperations });
        if (response.success) {
          return response.success;
        }
        return `Erro: ${response.error || 'Falha ao obter análise.'}`;
    }, [operationsLog, activeSymbol, incrementRequestCount]);

    const analyzeLosingTrade = useCallback(async (losingOp: Operation, activeStrategy: AutoTraderStrategyOutput | null): Promise<string | null> => {
        console.log(`[Loss Analyzer] Analyzing losing trade: ${losingOp.id}`);
        try {
            if (!chartData || chartData.length < 50) {
                throw new Error("Dados históricos insuficientes para analisar a perda.");
            }
            const historicalDataForAI = chartData.map(item => ({
                date: new Date(item.epoch * 1000).toISOString(),
                price: 'price' in item ? item.price : item.close
            }));
            
            const analysisInput = {
                operation: JSON.stringify(losingOp),
                historicalDataJson: JSON.stringify(historicalDataForAI),
                activeStrategyJson: JSON.stringify(activeStrategy), 
            };
            
            incrementRequestCount();
            const result = await analyzeTradeLossAction(analysisInput);

            if (result.success) {
               toast({
                  title: `Análise da Perda: ${result.success.analysis}`,
                  description: `Sugestão da IA: ${result.success.suggestion}`,
                  variant: "destructive",
                  duration: 10000,
               });
               return result.success.suggestion;
            } else {
               throw new Error(result.error || "A IA não conseguiu analisar a operação.");
            }
        } catch (e: any) {
            console.error("[Loss Analyzer] Error analyzing trade:", e);
            toast({ variant: 'destructive', title: "Erro na Análise", description: e.message });
            return null;
        }
    }, [toast, chartData, incrementRequestCount]);

    return {
        analyzeSessionPerformance,
        analyzeLosingTrade,
    };
}
