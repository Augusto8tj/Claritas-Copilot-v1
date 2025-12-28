
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import { getStrategyCouncilAction } from '@/app/actions/ai-actions';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import { StrategyCouncilOutputSchema } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import { useTradeAnalysis } from './use-trade-analysis';
import type { Indicators } from '@/services/indicator-service';
import { calculateAllIndicators } from '@/services/indicator-service';


export type RobotVote = {
    vote: 'RISE' | 'FALL' | 'HOLD';
    confidence: number;
    weight: number;
};
export type CouncilVotes = { [key: string]: RobotVote };

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';
export interface RobotPerformance {
    id: string;
    strategyType: RobotStrategy['strategyType'];
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
}

export type ManualPromptBatch = {
    id:string;
    theme: string;
    prompt: string;
    isCompleted: boolean;
    strategies: RobotStrategy['strategyType'][];
};


export function useRobotCouncil(
    activeSymbol: string | null
) {
    const { operationsLog, executeTrade, chartData } = useDerivApi();
    const { toast } = useToast();
    const form = useFormContext<RiseFallFormValues>();

    const [isCouncilAutopilotOn, setIsCouncilAutopilotOn] = useState(false);
    const [strategyCouncil, setStrategyCouncil] = useState<RobotStrategy[]>([]);
    const [isFetchingCouncil, setIsFetchingCouncil] = useState(false);
    const [councilVotes, setCouncilVotes] = useState<CouncilVotes>({});
    const [geminiRequestCount, setGeminiRequestCount] = useState(0);
    const [dailyBalance, setDailyBalance] = useState(100);
    const [dailyTarget, setDailyTarget] = useState(50);
    const [consensusThreshold, setConsensusThreshold] = useState(300);
    const [dynamicConsensus, setDynamicConsensus] = useState(300);
    const [isDynamicConsensusOn, setIsDynamicConsensusOn] = useState(true);
    const [isMeritocracyOn, setIsMeritocracyOn] = useState(true);
    const [robotPerformance, setRobotPerformance] = useState<RobotPerformance[]>([]);
    const [lastCouncilLossSuggestion, setLastCouncilLossSuggestion] = useState<string | null>(null);
    const [useManualCouncilMode, setUseManualCouncilMode] = useState(true);
    const [useSingleManualPrompt, setUseSingleManualPrompt] = useState(true);
    const [indicators, setIndicators] = useState<Indicators>({
        rsi: null, stoch: null, atr: null, adx: null, pdi: null, ndi: null,
        macd: { macd: null, signal: null }, ma: { short: null, long: null },
        sma: [], ema: [], vwap: [], bollingerBands: [],
        kama: null, bbw: null, stochRSI: null, zScore: null,
    });
    
    const [manualPromptBatches, setManualPromptBatches] = useState<ManualPromptBatch[]>([]);

    const councilExecutionRef = useRef({ isExecuting: false });

    const previousMacdRef = useRef<{ macd: number | null; signal: number | null }>({ macd: null, signal: null });


    const incrementGeminiRequestCount = useCallback(() => {
        setGeminiRequestCount(prev => prev + 1);
    }, []);

    const tradeAnalysis = useTradeAnalysis(activeSymbol, operationsLog, incrementGeminiRequestCount);
    
    const processNewChartData = useCallback((newChartData: any[]) => {
        if (newChartData.length > 0) {
            const calculated = calculateAllIndicators(newChartData, strategyCouncil);
            setIndicators(calculated);
        }
    }, [strategyCouncil]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
            if (stored) setRobotPerformance(JSON.parse(stored));
        } catch (e) { console.error("Failed to load robot performance from localStorage", e); }
    }, []);
    
    useEffect(() => {
        if (!operationsLog || operationsLog.length === 0) return;
        const lastOp = operationsLog[0];
        if (lastOp && lastOp.status === 'lost' && lastOp.initiator === 'Conselho') {
            tradeAnalysis.analyzeLosingTrade(lastOp, null).then(suggestion => {
                if (suggestion) {
                    setLastCouncilLossSuggestion(suggestion);
                    toast({
                        title: "Feedback do Analista de Perdas",
                        description: `Nova diretriz para o conselho: ${suggestion}`,
                        duration: 8000,
                    });
                }
            });
        }
    }, [operationsLog, tradeAnalysis, toast]);


    const fetchStrategyCouncil = useCallback(async () => {
        if (!activeSymbol) return;
        
        setIsFetchingCouncil(true);
        setManualPromptBatches([]);
        setStrategyCouncil([]);
        
        try {
            const { duration_unit } = form.getValues();
            
            const historicalDataJson = JSON.stringify(chartData.slice(-200));

            if (useManualCouncilMode) {
                const allStrategies: RobotStrategy['strategyType'][] = ['RSI', 'STOCHASTIC', 'MACD_CROSS', 'MOVING_AVERAGE_CROSS', 'BOLLINGER_BANDS', 'ADX_TREND', 'ICHIMOKU_CLOUD', 'AWESOME_OSCILLATOR', 'PRICE_ACTION_PATTERN', 'VOLUME_PROFILE', 'KAMA', 'VWAP', 'Z_SCORE', 'STOCH_RSI', 'MFI', 'TRIX', 'ROC', 'DONCHIAN_CHANNELS', 'RVI', 'PARABOLIC_SAR', 'CHANDELIER_EXIT', 'OBV'];
                
                const basePromptInstructions = `Sua resposta DEVE SER um único objeto JSON que valida contra o schema de saída, contendo uma chave "council" com um array de EXATAMENTE 22 objetos de robôs.
Regras para cada robô:
1. ID único (ex: 'RSI_BOT_1').
2. Preencha OBRIGATORIAMENTE os seguintes campos para cada robô: 'id', 'strategyType', 'justification', 'suggestedStake', 'suggestedDuration', 'suggestedDurationUnit', 'strongConfidence', 'weakConfidence', e os limiares e parâmetros específicos da estratégia (como 'strongBuyThreshold', 'period', 'shortPeriod', 'longPeriod').
3. Parâmetros e DOIS limiares (um para sinal FORTE, um para FRACO). Ex: 'strongBuyThreshold': 20, 'weakBuyThreshold': 30.
4. Confiança numérica: 'strongConfidence': 90-100, 'weakConfidence': 60-75.
5. Justificativa breve (1 frase).
6. Gestão de Risco: 'suggestedStake' como 1% da banca, 'suggestedDuration' na unidade fornecida.

Contexto do Trader:
- Banca do Dia: ${dailyBalance} USD
- Dados de Mercado: (Os dados de mercado serão usados internamente, não precisam ser incluídos no prompt).`;

                let batches: ManualPromptBatch[] = [];

                if (useSingleManualPrompt) {
                    const promptText = `Crie o conselho completo de 22 robôs-analistas para o ativo ${activeSymbol}, otimizados para operar em um horizonte de tempo de '${duration_unit}'.
Você deve criar um especialista para CADA UMA das 22 estratégias da lista disponível: ${JSON.stringify(allStrategies)}.
${basePromptInstructions}`;
                    batches = [{
                        id: 'batch_single',
                        theme: 'Prompt Único para Conselho Completo',
                        strategies: allStrategies,
                        prompt: promptText,
                        isCompleted: false,
                    }];

                } else {
                     const strategyBatchesConfig: { theme: string; strategies: RobotStrategy['strategyType'][] }[] = [
                        { theme: "Analistas de Momentum", strategies: ['RSI', 'STOCHASTIC', 'MACD_CROSS', 'STOCH_RSI', 'RVI'] },
                        { theme: "Analistas de Tendência", strategies: ['MOVING_AVERAGE_CROSS', 'ADX_TREND', 'PARABOLIC_SAR'] },
                        { theme: "Analistas de Volatilidade e Estrutura", strategies: ['BOLLINGER_BANDS', 'DONCHIAN_CHANNELS', 'KAMA'] },
                        { theme: "Analistas de Volume e Fluxo", strategies: ['VWAP', 'MFI', 'OBV'] },
                    ];

                    batches = strategyBatchesConfig.map((batch, index) => {
                        const promptText = `Crie um grupo de robôs-analistas para o ativo ${activeSymbol}, otimizados para operar em '${duration_unit}'.
Estratégias para construir nesta etapa: ${JSON.stringify(batch.strategies)}.
A resposta DEVE ser um objeto JSON contendo uma chave "council" com EXATAMENTE ${batch.strategies.length} objetos.
${basePromptInstructions}`;
                        return {
                            id: `batch_${index + 1}`,
                            theme: batch.theme,
                            strategies: batch.strategies,
                            prompt: promptText,
                            isCompleted: false,
                        };
                    });
                }
                
                setManualPromptBatches(batches);
                toast({
                    title: "Modo Manual Ativado",
                    description: "Siga as etapas na interface para montar o conselho.",
                    duration: 8000,
                });

            } else {
                incrementGeminiRequestCount();
                const councilInput = {
                    symbol: activeSymbol,
                    balance: dailyBalance,
                    currency: 'USD',
                    historicalDataJson: historicalDataJson,
                    durationUnit: duration_unit,
                };
                
                const result = await getStrategyCouncilAction(councilInput);
                if (result.success) {
                    setStrategyCouncil(result.success.council);
                    toast({ title: "Conselho de IA Montado!", description: `Os ${result.success.council.length} analistas-robôs estão prontos.` });
                } else {
                    throw new Error(result.error || "Ocorreu um erro inesperado ao gerar o conselho.");
                }
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao Montar o Conselho", description: e.message });
        } finally {
            setIsFetchingCouncil(false);
        }
    }, [activeSymbol, dailyBalance, form, toast, useManualCouncilMode, useSingleManualPrompt, incrementGeminiRequestCount, chartData]);

    const processManualCouncilResponse = (batchId: string, jsonResponse: string) => {
        try {
            const parsed = JSON.parse(jsonResponse);
            
            const validated = StrategyCouncilOutputSchema.safeParse(parsed);

            if (!validated.success) {
                console.error("Validation error:", validated.error);
                throw new Error(`O JSON fornecido não corresponde ao formato esperado para o conselho. Erros: ${validated.error.errors.map(e => e.message).join(', ')}`);
            }
            
            setStrategyCouncil(prev => [...prev, ...validated.data.council]);
            setManualPromptBatches(prev => prev.map(b => b.id === batchId ? { ...b, isCompleted: true } : b));

            const isAllCompleted = manualPromptBatches.every(b => b.id === batchId ? true : b.isCompleted);
            if (isAllCompleted) {
                toast({ title: "Conselho Montado com Sucesso!", description: "Todos os lotes de analistas foram processados." });
            } else {
                 toast({ title: "Lote Processado!", description: "Analistas adicionados ao conselho. Avance para o próximo lote." });
            }

        } catch (e: any) {
             toast({ variant: "destructive", title: "Erro ao Processar Resposta", description: `Verifique se o texto colado é um JSON válido. Detalhe: ${e.message}` });
        }
    };
    
    const supervisionCommitteeCheck = useCallback((stake: number, direction: 'RISE' | 'FALL') => {
        let finalStake = stake;
        let vetoReason: string | null = null;
    
        const dailyPnL = operationsLog
            .filter(op => op.initiator === 'Conselho' && op.status !== 'pending' && new Date(op.timestamp).toDateString() === new Date().toDateString())
            .reduce((sum, op) => sum + (op.result || 0), 0);

        if (dailyBalance > 0 && dailyPnL <= -dailyBalance) {
            vetoReason = "Limite de perda diária atingido. Operações bloqueadas.";
        } else if (dailyTarget > 0 && dailyPnL >= dailyTarget) {
            vetoReason = "Meta de lucro diária atingida. Operações bloqueadas.";
        }
    
        if (vetoReason) return { finalStake, vetoReason };

        const atr = indicators.atr;
        const lastClose = chartData.length > 0 ? (chartData[chartData.length - 1] as any).close : null;
        if (atr && lastClose) {
            const atrPercentage = (atr / lastClose) * 100;
            if (atrPercentage > 0.05) { 
                finalStake *= 0.75;
                toast({ title: "Supervisor de Volatilidade", description: "ATR alto. Risco reduzido para 75%.", variant: "default" });
            }
        }
        
        const adx = indicators.adx;
        if (adx) {
            if (adx < 20) { 
                finalStake *= 0.75;
                toast({ title: "Supervisor de Tendência", description: "ADX baixo (mercado lateral). Risco reduzido.", variant: "default" });
            } else if (adx > 35) { 
                finalStake *= 1.25; 
                toast({ title: "Supervisor de Tendência", description: "ADX alto (tendência forte). Risco aumentado.", variant: "default" });
            }
        }

        if (finalStake < 0.35) finalStake = 0.35;
        
        return { finalStake, vetoReason };

    }, [operationsLog, dailyBalance, dailyTarget, indicators, chartData, toast]);

    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setIsCouncilAutopilotOn(false);
        setManualPromptBatches([]);
        toast({ title: "Conselho Dissolvido", description: "A equipa de analistas foi dispensada." });
    };

    const committeeOfSpecialists = useCallback(() => {
        const activeSpecialists: RobotStrategy[] = [];
        const { adx, atr, bbw } = indicators;

        const isVolatile = (bbw && bbw > 0.04) || (atr && chartData.length > 0 && atr > ((chartData[chartData.length - 1] as any).close || 1) * 0.0005);
        if (isVolatile) {
            const volatilityBots = strategyCouncil.filter(r => ['BOLLINGER_BANDS', 'KAMA', 'ADX_TREND', 'CHANDELIER_EXIT'].includes(r.strategyType));
            activeSpecialists.push(...volatilityBots);
        }

        const isTrending = adx && adx > 25;
        if (isTrending) {
            const trendBots = strategyCouncil.filter(r => ['MOVING_AVERAGE_CROSS', 'MACD_CROSS', 'ICHIMOKU_CLOUD', 'PARABOLIC_SAR'].includes(r.strategyType));
            activeSpecialists.push(...trendBots);
        }

        if (!isTrending) {
             const rangeBots = strategyCouncil.filter(r => ['RSI', 'STOCHASTIC', 'Z_SCORE', 'STOCH_RSI', 'RVI'].includes(r.strategyType));
            activeSpecialists.push(...rangeBots);
        }

        if (activeSpecialists.length === 0) {
            const defaultBots = strategyCouncil.filter(r => ['RSI', 'MOVING_AVERAGE_CROSS'].includes(r.strategyType));
            activeSpecialists.push(...defaultBots);
        }

        return [...new Map(activeSpecialists.map(item => [item.id, item])).values()];

    }, [indicators, strategyCouncil, chartData]);

    useEffect(() => {
        if (!isCouncilAutopilotOn || councilExecutionRef.current.isExecuting || strategyCouncil.length === 0 || !indicators.rsi) {
            return;
        }
        
        let currentThreshold = consensusThreshold;
        if (isDynamicConsensusOn && indicators.atr) {
            const baseThreshold = 250;
            const volatilityFactor = indicators.atr * 1000;
            const dynamicThreshold = Math.round(baseThreshold + volatilityFactor);
            currentThreshold = Math.max(150, Math.min(700, dynamicThreshold));
            setDynamicConsensus(currentThreshold);
        }

        const newVotes: CouncilVotes = {};
        let riseConfidenceSum = 0, fallConfidenceSum = 0;
        
        const activeSpecialists = committeeOfSpecialists();

        activeSpecialists.forEach(robot => {
            let vote: RobotVote['vote'] = 'HOLD', confidence = 0;
            let weight = 1.0;
            if (isMeritocracyOn) {
                const perf = robotPerformance.find(p => p.id === robot.id);
                if (perf && (perf.wins + perf.losses) > 3) {
                     const winRate = perf.wins / (perf.wins + perf.losses);
                     weight = 0.5 + winRate;
                }
            }

            switch(robot.strategyType) {
                 case 'RSI':
                    if (indicators.rsi) {
                        if (robot.strongBuyThreshold && indicators.rsi <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (robot.weakBuyThreshold && indicators.rsi <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        else if (robot.strongSellThreshold && indicators.rsi >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                        else if (robot.weakSellThreshold && indicators.rsi >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                case 'STOCHASTIC':
                    if (indicators.stoch) {
                        if (robot.strongBuyThreshold && indicators.stoch <= robot.strongBuyThreshold) { vote = 'RISE'; confidence = robot.strongConfidence; }
                        else if (robot.weakBuyThreshold && indicators.stoch <= robot.weakBuyThreshold) { vote = 'RISE'; confidence = robot.weakConfidence; }
                        else if (robot.strongSellThreshold && indicators.stoch >= robot.strongSellThreshold) { vote = 'FALL'; confidence = robot.strongConfidence; }
                        else if (robot.weakSellThreshold && indicators.stoch >= robot.weakSellThreshold) { vote = 'FALL'; confidence = robot.weakConfidence; }
                    }
                    break;
                 case 'MACD_CROSS':
                    const { macd: currentMacd, signal: currentSignal } = indicators.macd;
                    const { macd: prevMacd, signal: prevSignal } = previousMacdRef.current;

                    if (currentMacd !== null && currentSignal !== null && prevMacd !== null && prevSignal !== null) {
                         if (prevMacd <= prevSignal && currentMacd > currentSignal) { vote = 'RISE'; confidence = robot.strongConfidence; }
                         if (prevMacd >= prevSignal && currentMacd < currentSignal) { vote = 'FALL'; confidence = robot.strongConfidence; }
                    }
                    break;
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
        
        previousMacdRef.current = indicators.macd;
        setCouncilVotes(newVotes);

        const consensusReached = Math.max(riseConfidenceSum, fallConfidenceSum) >= currentThreshold;
        if (consensusReached && activeSymbol) {
            councilExecutionRef.current.isExecuting = true;
            const direction = riseConfidenceSum > fallConfidenceSum ? 'RISE' : 'FALL';
            const baseStake = strategyCouncil[0]?.suggestedStake || form.getValues('stake');

            const { finalStake, vetoReason } = supervisionCommitteeCheck(baseStake, direction);

            if (vetoReason) {
                toast({ title: "Operação Vetada", description: vetoReason, variant: "destructive" });
                councilExecutionRef.current.isExecuting = false;
                if(vetoReason.includes("Limite de perda") || vetoReason.includes("Meta de lucro")){
                    setIsCouncilAutopilotOn(false);
                }
                return;
            }
            
            toast({ title: "Consenso Atingido!", description: `Executando ${direction} com stake ajustado de $${finalStake.toFixed(2)}.` });
            
            const { duration, duration_unit } = form.getValues();

            executeTrade(direction === 'RISE' ? 'CALL' : 'PUT', finalStake, activeSymbol, direction.toLowerCase() as 'rise' | 'fall', duration, duration_unit, 'Conselho')
                .finally(() => setTimeout(() => { councilExecutionRef.current.isExecuting = false; }, 10000));
        }
    }, [
        indicators,
        isCouncilAutopilotOn,
        strategyCouncil,
        consensusThreshold,
        isDynamicConsensusOn,
        isMeritocracyOn,
        robotPerformance,
        executeTrade,
        activeSymbol,
        toast,
        form,
        supervisionCommitteeCheck,
        committeeOfSpecialists
    ]);

    return {
        isCouncilAutopilotOn,
        setIsCouncilAutopilotOn,
        strategyCouncil,
        fetchStrategyCouncil,
        dissolveCouncil,
        isFetchingCouncil,
        councilVotes,
        geminiRequestCount,
        incrementGeminiRequestCount,
        dailyBalance,
        setDailyBalance,
        dailyTarget,
        setDailyTarget,
        consensusThreshold: isDynamicConsensusOn ? dynamicConsensus : consensusThreshold,
        setConsensusThreshold,
        isDynamicConsensusOn,
        setIsDynamicConsensusOn,
        isMeritocracyOn,
        setIsMeritocracyOn,
        manualPromptBatches,
        processManualCouncilResponse,
        useManualCouncilMode,
        setUseManualCouncilMode,
        useSingleManualPrompt,
        setUseSingleManualPrompt,
        indicators,
        processNewChartData
    };
}
