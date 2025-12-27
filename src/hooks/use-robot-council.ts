'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { useToast } from './use-toast';
import { getStrategyCouncilAction } from '@/app/actions/ai-actions';
import type { RobotStrategy, StrategyCouncilOutput } from '@/ai/flows/strategy-council-flow.types';
import { RobotAnalystGeneratorOutputSchema } from '@/ai/flows/strategy-council-flow.types';
import type { RiseFallFormValues } from '@/components/trading/deriv-trader-interface.types';
import { useFormContext } from 'react-hook-form';
import { useTradeAnalysis } from './use-trade-analysis';
import type { Operation, OperationInitiator } from '@/components/trading/operations-log.types';
import type { CandleData, ChartData } from './types';


// ========================================================
// INTERNAL INDICATOR CALCULATION ENGINE
// ========================================================
const calculateSMA = (data: CandleData[], period: number): (number | null)[] => {
    if (data.length < period) return Array(data.length).fill(null);
    const smaValues: (number | null)[] = Array(period - 1).fill(null);
    let sum = 0;
    for(let i=0; i<period; i++) sum += data[i].close;
    smaValues.push(sum / period);
    for(let i=period; i<data.length; i++){
        sum = sum - data[i-period].close + data[i].close;
        smaValues.push(sum / period);
    }
    return smaValues;
}

const calculateEMA = (data: CandleData[], period: number): (number | null)[] => {
  if (data.length < period) return Array(data.length).fill(null);
  const k = 2 / (period + 1)
  const emaValues: (number | null)[] = Array(period - 1).fill(null);
  let sum = data.slice(0, period).reduce((acc, d) => acc + d.close, 0);
  emaValues.push(sum / period);

  for (let i = period; i < data.length; i++) {
    const prevEma = emaValues[i - 1];
    if(prevEma !== null) {
      emaValues.push(data[i].close * k + prevEma * (1 - k));
    } else {
      emaValues.push(null);
    }
  }
  return emaValues;
}

const calculateBollingerBands = (data: CandleData[], period = 20, stdDev = 2) => {
    if (data.length < period) return Array(data.length).fill(null);
    const bands: ({ upper: number; middle: number; lower: number } | null)[] = Array(period - 1).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const middle = slice.reduce((sum, d) => sum + d.close, 0) / period;
        const standardDeviation = Math.sqrt(slice.reduce((sum, d) => sum + Math.pow(d.close - middle, 2), 0) / period);
        bands.push({
            upper: middle + stdDev * standardDeviation,
            middle: middle,
            lower: middle - stdDev * standardDeviation
        });
    }
    return bands;
};

const calculateVWAP = (data: CandleData[]): (number | null)[] => {
    const vwapValues: (number | null)[] = [];
    let cumulativeTypicalPriceVolume = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (d.volume) {
            const typicalPrice = (d.high + d.low + d.close) / 3;
            cumulativeTypicalPriceVolume += typicalPrice * d.volume;
            cumulativeVolume += d.volume;
            vwapValues.push(cumulativeVolume > 0 ? cumulativeTypicalPriceVolume / cumulativeVolume : null);
        } else {
            vwapValues.push(null);
        }
    }
    return vwapValues;
};

const calculateRSI = (data: CandleData[], period = 14): (number | null)[] => {
    if (data.length < period) return Array(data.length).fill(null);

    const rsiValues: (number | null)[] = Array(period - 1).fill(null);
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i < period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) {
            avgGain += change;
        } else {
            avgLoss -= change;
        }
    }
    avgGain /= period;
    avgLoss /= period;

    let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));

    for (let i = period; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        let gain = change > 0 ? change : 0;
        let loss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        rsiValues.push(100 - (100 / (1 + rs)));
    }
    return rsiValues;
};

const calculateStochastic = (data: CandleData[], period = 14) => {
    if (data.length < period) return Array(data.length).fill(null);

    const kValues: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            kValues.push(null);
            continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const lowestLow = Math.min(...slice.map(d => d.low));
        const highestHigh = Math.max(...slice.map(d => d.high));
        const currentClose = slice[slice.length - 1].close;
        if (highestHigh === lowestLow) {
            kValues.push(i > 0 && kValues[i-1] ? kValues[i-1] : 50);
        } else {
            kValues.push(100 * ((currentClose - lowestLow) / (highestHigh - lowestLow)));
        }
    }
    return kValues;
};

const calculateMACD = (data: CandleData[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (data.length < slowPeriod) return { macd: [], signal: [], histogram: [] };

    const emaFast = calculateEMA(data, fastPeriod);
    const emaSlow = calculateEMA(data, slowPeriod);
    
    const macdLine = data.map((_, i) => (emaFast[i] && emaSlow[i]) ? emaFast[i]! - emaSlow[i]! : null);
    
    const signalData = macdLine.map(v => v !== null ? { close: v, high:v, low:v, epoch:0, open:v } : null).filter((v): v is CandleData => v !== null);

    const signalLine = calculateEMA(signalData, signalPeriod);

    const macdWithNulls = [...Array(slowPeriod - 1).fill(null), ...macdLine.slice(slowPeriod-1)];
    const signalWithNulls = [...Array(slowPeriod + signalPeriod - 2).fill(null), ...signalLine.map(s => s)];

    const histogram = macdWithNulls.map((m, i) => (m && signalWithNulls[i]) ? m - signalWithNulls[i]! : null);

    return { macd: macdWithNulls, signal: signalWithNulls, histogram };
};

const calculateATR = (data: CandleData[], period = 14): (number | null)[] => {
    if (data.length < 1) return [];
    
    const trueRanges: (number | null)[] = [null];
    for (let i = 1; i < data.length; i++) {
        const highLow = data[i].high - data[i].low;
        const highPrevClose = Math.abs(data[i].high - data[i-1].close);
        const lowPrevClose = Math.abs(data[i].low - data[i-1].close);
        trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
    
    const atrValues: (number | null)[] = Array(period).fill(null);
    if (data.length < period + 1) return Array(data.length).fill(null);
    
    let firstAtrSum = trueRanges.slice(1, period + 1).reduce((sum, val) => sum + (val || 0), 0);
    atrValues.push(firstAtrSum / period);
    
    for (let i = period + 1; i < data.length; i++) {
        const prevAtr = atrValues[i-1];
        const tr = trueRanges[i];
        if (tr === null || prevAtr === null) {
            atrValues.push(atrValues[i - 1]);
            continue;
        }
        const currentAtr = (prevAtr * (period - 1) + tr) / period;
        atrValues.push(currentAtr);
    }
    
    return atrValues;
};

const calculateADX = (data: CandleData[], period = 14) => {
    if (data.length < period * 2) return { adx: [], pdi: [], ndi: [] };

    let pdi: (number | null)[] = [], ndi: (number | null)[] = [], trs: (number | null)[] = [];
    
    for (let i = 1; i < data.length; i++) {
        const upMove = data[i].high - data[i - 1].high;
        const downMove = data[i-1].low - data[i].low;
        
        const pdm = (upMove > downMove && upMove > 0) ? upMove : 0;
        const ndm = (downMove > upMove && downMove > 0) ? downMove : 0;
        
        pdi.push(pdm);
        ndi.push(ndm);
        
        const tr = Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i-1].close), Math.abs(data[i].low - data[i-1].close));
        trs.push(tr);
    }
    
    const smooth = (values: (number | null)[]) => {
        if(values.length < period) return [];
        let smoothed: (number | null)[] = [values.slice(0, period).reduce((acc, v) => acc + (v||0), 0)];
        for (let i = period; i < values.length; i++) {
            smoothed.push(smoothed[i-period]! - (smoothed[i-period]! / period) + (values[i] || 0));
        }
        return smoothed;
    };

    const smoothedPDI = smooth(pdi);
    const smoothedNDI = smooth(ndi);
    const smoothedTR = smooth(trs);
    
    let pdiFinal: (number | null)[] = [], ndiFinal: (number | null)[] = [], dx: (number | null)[] = [];

    for(let i=0; i< smoothedTR.length; i++){
        if(!smoothedTR[i] || smoothedTR[i] === 0) {
             pdiFinal.push(null);
             ndiFinal.push(null);
             continue;
        };
        pdiFinal.push(100 * (smoothedPDI[i]! / smoothedTR[i]!));
        ndiFinal.push(100 * (smoothedNDI[i]! / smoothedTR[i]!));
    }

    for (let i = 0; i < pdiFinal.length; i++) {
        if (pdiFinal[i] === null || ndiFinal[i] === null) {
            dx.push(null);
            continue;
        }
        const den = pdiFinal[i]! + ndiFinal[i]!;
        if (den === 0) {
            dx.push(0);
        } else {
            dx.push(100 * Math.abs(pdiFinal[i]! - ndiFinal[i]!) / den);
        }
    }
    
    const adx = smooth(dx.filter((v): v is number => v !== null));
    
    const fillCount = data.length - adx.length;
    return { adx: Array(fillCount).fill(null).concat(adx), pdi: pdiFinal, ndi: ndiFinal };
};
// ========================================================
// END OF INDICATOR ENGINE
// ========================================================


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
    strategy: RobotStrategy; // Adicionado para renderização
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
    activeSymbol: string | null
) {
    const { isConnected, chartData, operationsLog, executeTrade } = useDerivApi();
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

    // This state now lives inside the hook and is calculated here
    const [indicators, setIndicators] = useState({
        rsi: null as number | null,
        stoch: null as number | null,
        atr: null as number | null,
        adx: null as number | null,
        pdi: null as number | null,
        ndi: null as number | null,
        macd: null as { macd: number | null, signal: number | null } | null,
        ma: { short: null, long: null } as { short: number | null, long: number | null },
        sma: [] as (number | null)[],
        ema: [] as (number | null)[],
        vwap: [] as (number | null)[],
        bollingerBands: [] as ({ upper: number; middle: number; lower: number } | null)[],
    });


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
            if (!chartData || chartData.length < 50) throw new Error("Dados históricos insuficientes.");

            const historicalDataJson = JSON.stringify(chartData.map(d => ({...d, date: new Date(d.epoch * 1000).toISOString()})))

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
- Dados de Mercado: \'\'\'json
${historicalDataJson}
\'\'\'`;

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
    }, [activeSymbol, dailyBalance, form, toast, chartData, useManualCouncilMode, useSingleManualPrompt, incrementGeminiRequestCount]);

    const processManualCouncilResponse = (batchId: string, jsonResponse: string) => {
        try {
            const parsed = JSON.parse(jsonResponse);
            // Be flexible: accept "robots" or "council" as the key
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
        const lastPrice = chartData.length > 0 ? ('price' in chartData[chartData.length-1] ? chartData[chartData.length-1].price : (chartData[chartData.length-1] as any).close) : 0;

        if (atr && lastPrice > 0) {
            const normalizedATR = atr / lastPrice; 
            if (normalizedATR > 0.0005) { 
                finalStake *= 0.5;
                toast({ title: "Supervisor de Volatilidade", description: "Mercado turbulento, risco reduzido para 50%.", variant: "default" });
            } else if (normalizedATR < 0.0001) {
                finalStake *= 0.75;
                toast({ title: "Supervisor de Volatilidade", description: "Mercado parado, risco reduzido para 75%.", variant: "default" });
            }
        }
    
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

    }, [operationsLog, dailyBalance, dailyTarget, indicators, chartData, toast]);

    const dissolveCouncil = () => {
        setStrategyCouncil([]);
        setCouncilVotes({});
        setIsCouncilAutopilotOn(false);
        setManualPromptBatches([]);
        toast({ title: "Conselho Dissolvido", description: "A equipa de analistas foi dispensada." });
    };

    // Effect to calculate indicators whenever chartData or council changes
    useEffect(() => {
        if (!chartData.length || !strategyCouncil.length) return;

        const candles = chartData.filter(d => 'close' in d) as CandleData[];
        if (candles.length < 2) return;

        const rsiRobot = strategyCouncil.find(r => r.strategyType === 'RSI');
        const stochRobot = strategyCouncil.find(r => r.strategyType === 'STOCHASTIC');
        const macdRobot = strategyCouncil.find(r => r.strategyType === 'MACD_CROSS');
        const adxRobot = strategyCouncil.find(r => r.strategyType === 'ADX_TREND');
        const maRobot = strategyCouncil.find(r => r.strategyType === 'MOVING_AVERAGE_CROSS');
        const bbRobot = strategyCouncil.find(r => r.strategyType === 'BOLLINGER_BANDS');

        const rsiValues = rsiRobot ? calculateRSI(candles, rsiRobot.period || 14) : [];
        const stochValues = stochRobot ? calculateStochastic(candles, stochRobot.period || 14) : [];
        const macdValues = macdRobot ? calculateMACD(candles, macdRobot.fastPeriod || 12, macdRobot.slowPeriod || 26, macdRobot.signalPeriod || 9) : { macd: [], signal: [] };
        const adxValues = adxRobot ? calculateADX(candles, adxRobot.period || 14) : { adx: [], pdi: [], ndi: [] };
        const atrValues = calculateATR(candles);
        
        const smaValues = maRobot ? calculateSMA(candles, maRobot.longPeriod || 20) : [];
        const emaValues = maRobot ? calculateEMA(candles, maRobot.shortPeriod || 10) : [];
        const vwapValues = calculateVWAP(candles);
        const bbValues = bbRobot ? calculateBollingerBands(candles, bbRobot.period || 20, bbRobot.stdDev || 2) : [];

        setIndicators({
            rsi: rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null,
            stoch: stochValues.length > 0 ? stochValues[stochValues.length - 1] : null,
            macd: { 
                macd: macdValues.macd.length > 0 ? macdValues.macd[macdValues.macd.length - 1] : null,
                signal: macdValues.signal.length > 0 ? macdValues.signal[macdValues.signal.length - 1] : null,
             },
            adx: adxValues.adx.length > 0 ? adxValues.adx[adxValues.adx.length - 1] : null,
            pdi: adxValues.pdi.length > 0 ? adxValues.pdi[adxValues.pdi.length - 1] : null,
            ndi: adxValues.ndi.length > 0 ? adxValues.ndi[adxValues.ndi.length - 1] : null,
            atr: atrValues.length > 0 ? atrValues[atrValues.length - 1] : null,
            sma: smaValues,
            ema: emaValues,
            vwap: vwapValues,
            bollingerBands: bbValues,
            ma: {
                short: emaValues.length > 0 ? emaValues[emaValues.length - 1] : null,
                long: smaValues.length > 0 ? smaValues[smaValues.length - 1] : null,
            }
        });

    }, [chartData, strategyCouncil]);


    // Effect for council voting and execution
    useEffect(() => {
        if (!isCouncilAutopilotOn || !strategyCouncil.length || councilExecutionRef.current.isExecuting) return;

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

            // A lógica de votação permanece a mesma
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
            }

            newVotes[robot.id] = { vote, confidence, weight };
            if (vote === 'RISE') riseConfidenceSum += confidence * weight;
            if (vote === 'FALL') fallConfidenceSum += confidence * weight;
        });
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
        isCouncilAutopilotOn, 
        indicators, // O gatilho principal agora são os indicadores
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
        indicators,
        manualPromptBatches,
        processManualCouncilResponse,
        useManualCouncilMode,
        setUseManualCouncilMode,
        useSingleManualPrompt,
        setUseSingleManualPrompt,
    };
}
