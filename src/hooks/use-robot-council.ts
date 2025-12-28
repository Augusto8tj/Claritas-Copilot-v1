

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import { getStrategyCouncilAction } from '@/app/actions/ai-actions';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import { RobotAnalystGeneratorOutputSchema } from '@/ai/flows/strategy-council-flow.types';
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
    id: string;
    theme: string;
    prompt: string;
    isCompleted: boolean;
    strategies: RobotStrategy['strategyType'][];
};


export function useRobotCouncil(
    activeSymbol: string | null,
    indicators: Indicators // Receive indicators as a prop
) {
    const { operationsLog, executeTrade, chartData } = useDerivApi(); // chartData for manual prompt generation
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
    
    const [manualPromptBatches, setManualPromptBatches] = useState<ManualPromptBatch[]>([]);

    const councilExecutionRef = useRef({ isExecuting: false });

    const previousMacdRef = useRef<{ macd: number | null; signal: number | null }>({ macd: null, signal: null });


    const incrementGeminiRequestCount = useCallback(() => {
        setGeminiRequestCount(prev => prev + 1);
    }, []);

    const tradeAnalysis = useTradeAnalysis(activeSymbol, operationsLog, incrementGeminiRequestCount);

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
            
            const historicalDataJson = JSON.stringify(chartData);

            if (useManualCouncilMode) {
                const allStrategies: RobotStrategy['strategyType'][] = ['RSI', 'STOCHASTIC', 'MACD_CROSS', 'MOVING_AVERAGE_CROSS', 'BOLLINGER_BANDS', 'ADX_TREND', 'ICHIMOKU_CLOUD', 'AWESOME_OSCILLATOR', 'PRICE_ACTION_PATTERN', 'VOLUME_PROFILE'];
                
                const basePromptInstructions = `Sua resposta DEVE SER um objeto JSON contendo uma chave "robots" que é um array com objetos de robôs.
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
                    const promptText = `Crie um conselho completo de 10 robôs-analistas para o ativo ${activeSymbol}, otimizados para operar em '${duration_unit}'.
As estratégias a serem criadas são: ${JSON.stringify(allStrategies)}.
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
                        { theme: "Analistas de Momentum", strategies: ['RSI', 'STOCHASTIC', 'MACD_CROSS'] },
                        { theme: "Analistas de Tendência e Volatilidade", strategies: ['MOVING_AVERAGE_CROSS', 'BOLLINGER_BANDS', 'ADX_TREND'] },
                        { theme: "Analistas de Padrões e Volume", strategies: ['ICHIMOKU_CLOUD', 'AWESOME_OSCILLATOR', 'PRICE_ACTION_PATTERN', 'VOLUME_PROFILE'] },
                    ];

                    batches = strategyBatchesConfig.map((batch, index) => {
                        const promptText = `Crie um grupo de robôs-analistas para o ativo ${activeSymbol}, otimizados para operar em '${duration_unit}'.
Estratégias para construir nesta etapa: ${JSON.stringify(batch.strategies)}.
A resposta DEVE ser um objeto JSON contendo uma chave "robots" com EXATAMENTE ${batch.strategies.length} objetos.
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
                    toast({ title: "Conselho de IA Montado!", description: "Os 10 analistas-robôs estão prontos para a sessão." });
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
            const dataToValidate = parsed.robots || parsed.council || [];
            
            const validated = RobotAnalystGeneratorOutputSchema.safeParse({ robots: dataToValidate });

            if (!validated.success) {
                console.error("Validation error:", validated.error);
                throw new Error(`O JSON fornecido não corresponde ao formato esperado para os robôs. Erros: ${validated.error.errors.map(e => e.message).join(', ')}`);
            }
            
            setStrategyCouncil(prev => [...prev, ...validated.data.robots]);
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
        // The last price is not available here, so we skip the ATR check for now.
        // A more robust solution would involve passing the last data point.

        const adx = indicators.adx;
        if (adx) {
            if (adx < 20) {
                finalStake *= 0.75;
                toast({ title: "Supervisor de Tendência", description: "Mercado lateral, risco reduzido para 75%.", variant: "default" });
            } else if (adx > 35) {
                finalStake *= 1.25; 
                toast({ title: "Supervisor de Tendência", description: "Tendência forte confirmada, risco aumentado em 25%.", variant: "default" });
            }
        }

        if (finalStake < 0.35) finalStake = 0.35;
        
        return { finalStake, vetoReason };

    }, [operationsLog, dailyBalance, dailyTarget, indicators, toast]);

    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setIsCouncilAutopilotOn(false);
        setManualPromptBatches([]);
        toast({ title: "Conselho Dissolvido", description: "A equipa de analistas foi dispensada." });
    };

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

        strategyCouncil.forEach(robot => {
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
                // Add other strategy voting logic here...
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
            const baseStake = strategyCouncil[0].suggestedStake;

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
        indicators, // This is now the primary trigger
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
        supervisionCommitteeCheck
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
    };
}
