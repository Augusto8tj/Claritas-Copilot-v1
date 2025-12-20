

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Zap, BrainCircuit, Bot, Power, Info } from "lucide-react";
import { getAutotraderStrategyAction } from "@/app/actions/ai-actions";
import type { AutoTraderStrategyOutput } from "@/ai/flows/auto-trader-strategy-flow.types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { useToast } from "@/hooks/use-toast";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import type { RiseFallFormValues } from "./deriv-trader-interface.types";
import type { UseFormReturn } from "react-hook-form";

interface AutoTraderInterfaceProps {
  symbol: string;
  onExecuteTrade: (
    contractType: string,
    stake: number,
    symbol: string,
    tradeDirection: 'rise' | 'fall',
    duration: number,
    durationUnit: any
  ) => Promise<any>;
  form: UseFormReturn<RiseFallFormValues>;
}

const STRATEGY_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

const calculateRSI = (ticks: { price: number }[], period = 14) => {
    if (ticks.length < period) return null;

    const prices = ticks.map(t => t.price);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const difference = prices[prices.length - i] - prices[prices.length - i - 1];
        if (difference >= 0) {
            gains += difference;
        } else {
            losses -= difference;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) {
            avgGain = (avgGain * (period - 1) + difference) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgLoss = (avgLoss * (period - 1) - difference) / period;
            avgGain = (avgGain * (period - 1)) / period;
        }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

const calculateStochastic = (ticks: { price: number }[], period = 14) => {
    if (ticks.length < period) return null;

    const relevantTicks = ticks.slice(-period);
    const lowestLow = Math.min(...relevantTicks.map(t => t.price));
    const highestHigh = Math.max(...relevantTicks.map(t => t.price));
    const currentClose = relevantTicks[relevantTicks.length - 1].price;

    if (highestHigh === lowestLow) return 50;

    return 100 * ((currentClose - lowestLow) / (highestHigh - lowestLow));
};

export function AutoTraderInterface({ symbol, onExecuteTrade, form }: AutoTraderInterfaceProps) {
  const [strategy, setStrategy] = useState<AutoTraderStrategyOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isAutopilotOn, setIsAutopilotOn] = useState(false);
  const [currentRSI, setCurrentRSI] = useState<number | null>(null);
  const [currentStoch, setCurrentStoch] = useState<number | null>(null);
  
  const { toast } = useToast();
  const { accountBalance, operationsLog, priceTicks, isConnected } = useDerivApi();
  const strategyIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStrategy = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const formData = form.getValues();
        const historicalData = priceTicks.length > 50 ? priceTicks.slice(-200).map(t => ({ date: new Date(t.epoch * 1000).toISOString(), price: t.price })) : [];
        if(historicalData.length === 0) {
            throw new Error("Dados de preço insuficientes para definir uma estratégia.");
        }
        
        const result = await getAutotraderStrategyAction({
            symbol,
            balance: accountBalance.balance || 0,
            currency: accountBalance.currency || 'USD',
            stake: formData.stake,
            duration: formData.duration,
            durationUnit: formData.duration_unit,
            recentTrades: operationsLog.slice(0, 5),
            historicalData: historicalData
        });

        if (result.success) {
            setStrategy(result.success);
            toast({ title: "Nova Estratégia do Piloto Automático", description: result.success.justification });
        } else {
            throw new Error(result.error || "Ocorreu um erro desconhecido.");
        }
    } catch (e: any) {
       setError(e.message || "Ocorreu um erro ao definir a estratégia.");
       setStrategy(null);
       // Turn off autopilot on error to prevent unwanted behavior
       setIsAutopilotOn(false);
    }
    setIsLoading(false);
  }, [symbol, form, accountBalance, operationsLog, priceTicks, toast]);

  const checkAndExecute = useCallback(async () => {
    if (isExecuting || !isAutopilotOn || !strategy || (currentRSI === null && currentStoch === null)) return;

    let conditionMet = false;
    if (strategy.strategyName === 'RSI_BASIC' && strategy.rsiThreshold && currentRSI !== null) {
        if (strategy.direction === 'RISE' && currentRSI <= strategy.rsiThreshold) {
            conditionMet = true;
        } else if (strategy.direction === 'FALL' && currentRSI >= strategy.rsiThreshold) {
            conditionMet = true;
        }
    } else if (strategy.strategyName === 'STOCH_BASIC' && strategy.stochThreshold && currentStoch !== null) {
        if (strategy.direction === 'RISE' && currentStoch <= strategy.stochThreshold) {
            conditionMet = true;
        } else if (strategy.direction === 'FALL' && currentStoch >= strategy.stochThreshold) {
            conditionMet = true;
        }
    }

    if (conditionMet) {
        setIsExecuting(true);
        const { allowEquals } = form.getValues();
        const stake = strategy.suggestedStake;
        const duration = strategy.suggestedDuration;
        
        toast({ title: "Piloto Automático", description: `Condição de ${strategy.direction} atingida! Executando com Aposta: $${stake.toFixed(2)} e Duração: ${duration} ticks.` });
        
        let contractType: string;
        if (strategy.direction === 'RISE') {
            contractType = allowEquals ? 'CALLE' : 'CALL';
        } else { // 'FALL'
            contractType = allowEquals ? 'PUTE' : 'PUT';
        }

        await onExecuteTrade(contractType, stake, symbol, strategy.direction.toLowerCase() as 'rise' | 'fall', duration, 't'); // Duration is now in ticks
        
        // Pause for a short while after execution to prevent rapid-fire trades
        setTimeout(() => setIsExecuting(false), 10000); 
    }
  }, [isExecuting, isAutopilotOn, strategy, currentRSI, currentStoch, form, onExecuteTrade, symbol, toast]);

  const handleToggleAutopilot = () => {
    const willBeOn = !isAutopilotOn;

    if (willBeOn) {
        if (!isConnected) {
            toast({ variant: "destructive", title: "Piloto Automático", description: "Conecte-se à corretora antes de ativar o piloto automático." });
            return;
        }
        setIsAutopilotOn(true);
        fetchStrategy(); // Fetch initial strategy
        strategyIntervalRef.current = setInterval(fetchStrategy, STRATEGY_REFRESH_INTERVAL);
    } else {
        setIsAutopilotOn(false);
        if (strategyIntervalRef.current) {
            clearInterval(strategyIntervalRef.current);
        }
        setStrategy(null);
    }
  };

  // Turn off autopilot if connection is lost
  useEffect(() => {
      if(!isConnected && isAutopilotOn) {
          handleToggleAutopilot();
          toast({ variant: "destructive", title: "Piloto Automático Desativado", description: "A conexão com a corretora foi perdida." });
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isAutopilotOn, toast]);

  useEffect(() => {
    if (priceTicks.length > 14) {
      setCurrentRSI(calculateRSI(priceTicks));
      setCurrentStoch(calculateStochastic(priceTicks));
    }
  }, [priceTicks]);

  useEffect(() => {
    if (isAutopilotOn) {
        checkAndExecute();
    }
  }, [isAutopilotOn, checkAndExecute, currentRSI, currentStoch]);
  
  const getActiveIndicatorValue = () => {
    if (!strategy) return "N/A";
    if (strategy.strategyName === 'RSI_BASIC') return currentRSI?.toFixed(2) ?? "Calculando...";
    if (strategy.strategyName === 'STOCH_BASIC') return currentStoch?.toFixed(2) ?? "Calculando...";
    return "N/A";
  }
  const getActiveIndicatorName = () => {
    if (!strategy) return "Indicador";
    if (strategy.strategyName === 'RSI_BASIC') return "RSI Atual";
    if (strategy.strategyName === 'STOCH_BASIC') return "Estocástico Atual";
    return "Indicador";
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Piloto Automático
            </CardTitle>
            <div className="flex items-center space-x-2">
                <Switch id="autopilot-switch" checked={isAutopilotOn} onCheckedChange={handleToggleAutopilot}/>
                <Label htmlFor="autopilot-switch">{isAutopilotOn ? "Ativado" : "Desativado"}</Label>
            </div>
        </div>
        <CardDescription>
          Deixe a IA definir e executar uma estratégia de trading para você.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAutopilotOn && (
            isLoading ? (
                <div className="flex items-center justify-center text-muted-foreground p-4">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Definindo estratégia...</span>
                </div>
            ) : error ? (
                 <Alert variant="destructive">
                    <AlertTitle>Erro na Estratégia</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : strategy ? (
                <Alert className="bg-primary/5 border-primary/20">
                    <AlertTitle className="text-primary flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Estratégia Ativa: {strategy.strategyName}
                    </AlertTitle>
                    <AlertDescription className="text-primary/90 space-y-2 mt-2">
                        <p>{strategy.justification}</p>
                        <Separator className="bg-primary/20"/>
                        <p className="font-semibold">Condição: Comprar {strategy.direction} se {strategy.strategyName === 'RSI_BASIC' ? 'RSI' : 'Estocástico'} {strategy.direction === 'RISE' ? '<=' : '>='} {strategy.rsiThreshold || strategy.stochThreshold}.</p>
                        <div className="text-xs space-y-1">
                            <p>Aposta Sugerida: <strong>${strategy.suggestedStake.toFixed(2)}</strong></p>
                            <p>Duração Sugerida: <strong>{strategy.suggestedDuration} ticks</strong></p>
                        </div>
                        <Separator className="bg-primary/20"/>
                        <p className="font-bold">{getActiveIndicatorName()}: {getActiveIndicatorValue()}</p>
                    </AlertDescription>
                </Alert>
            ) : (
                 <div className="text-center text-muted-foreground p-4">
                    Aguardando definição da estratégia...
                </div>
            )
        )}
        {!isAutopilotOn && (
             <div className="text-center text-muted-foreground p-4 border rounded-md bg-muted/50">
                <Info className="h-5 w-5 mx-auto mb-2" />
                <p className="text-sm">O Piloto Automático está desativado.</p>
                <p className="text-xs">Ative para começar a negociar automaticamente.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
