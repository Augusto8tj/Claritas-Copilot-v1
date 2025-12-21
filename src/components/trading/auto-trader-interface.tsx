'use client';

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
import type { AutoTraderStrategyOutput } from "@/ai/flows/auto-trader-strategy-flow.types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { useToast } from "@/hooks/use-toast";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import type { RiseFallFormValues } from "./deriv-trader-interface.types";
import type { UseFormReturn } from "react-hook-form";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";

interface AutoTraderInterfaceProps {
  symbol: string;
  onExecuteTrade: (
    contractType: string,
    stake: number,
    symbol: string,
    tradeDirection: 'rise' | 'fall',
    duration: number,
    durationUnit: any,
    isAutopilot: boolean
  ) => Promise<any>;
  form: UseFormReturn<RiseFallFormValues>;
}


export function AutoTraderInterface({ symbol, onExecuteTrade, form }: AutoTraderInterfaceProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  
  const { toast } = useToast();
  const { 
    isConnected, 
    priceTicks, 
    isAutopilotOn,
    setIsAutopilotOn,
    autopilotStrategy,
    fetchAutopilotStrategy,
    currentRSI,
    currentStoch,
    geminiRequestCount,
    dailyBalance,
    setDailyBalance,
  } = useDerivApi();
  
  const strategyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const STRATEGY_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos


  const checkAndExecute = useCallback(async () => {
    if (isExecuting || !isAutopilotOn || !autopilotStrategy || (currentRSI === null && currentStoch === null)) return;

    let conditionMet = false;
    if (autopilotStrategy.strategyName === 'RSI_BASIC' && autopilotStrategy.rsiThreshold && currentRSI !== null) {
        if (autopilotStrategy.direction === 'RISE' && currentRSI <= autopilotStrategy.rsiThreshold) {
            conditionMet = true;
        } else if (autopilotStrategy.direction === 'FALL' && currentRSI >= autopilotStrategy.rsiThreshold) {
            conditionMet = true;
        }
    } else if (autopilotStrategy.strategyName === 'STOCH_BASIC' && autopilotStrategy.stochThreshold && currentStoch !== null) {
        if (autopilotStrategy.direction === 'RISE' && currentStoch <= autopilotStrategy.stochThreshold) {
            conditionMet = true;
        } else if (autopilotStrategy.direction === 'FALL' && currentStoch >= autopilotStrategy.stochThreshold) {
            conditionMet = true;
        }
    }

    if (conditionMet) {
        setIsExecuting(true);
        const { allowEquals } = form.getValues();
        const stake = autopilotStrategy.suggestedStake;
        const duration = autopilotStrategy.suggestedDuration;
        
        toast({ title: "Piloto Automático", description: `Condição de ${autopilotStrategy.direction} atingida! Executando com Aposta: $${stake.toFixed(2)} e Duração: ${duration} ticks.` });
        
        let contractType: string;
        if (autopilotStrategy.direction === 'RISE') {
            contractType = allowEquals ? 'CALLE' : 'CALL';
        } else { // 'FALL'
            contractType = allowEquals ? 'PUTE' : 'PUT';
        }

        await onExecuteTrade(contractType, stake, symbol, autopilotStrategy.direction.toLowerCase() as 'rise' | 'fall', duration, 't', true);
        
        // Pause for a short while after execution to prevent rapid-fire trades
        setTimeout(() => setIsExecuting(false), 10000); 
    }
  }, [isExecuting, isAutopilotOn, autopilotStrategy, currentRSI, currentStoch, form, onExecuteTrade, symbol, toast]);

  const handleToggleAutopilot = (isOn: boolean) => {
    if (isOn) {
        if (!isConnected) {
            toast({ variant: "destructive", title: "Piloto Automático", description: "Conecte-se à corretora antes de ativar o piloto automático." });
            return;
        }
        setIsAutopilotOn(true);
    } else {
        setIsAutopilotOn(false);
    }
  };

  // Effect to manage the strategy refresh interval based on isAutopilotOn state
  useEffect(() => {
    if (isAutopilotOn) {
        console.log("[Autopilot] Turned ON. Fetching initial strategy and starting check cycle.");
        fetchAutopilotStrategy();
        
        if (strategyIntervalRef.current) clearInterval(strategyIntervalRef.current);
        
        strategyIntervalRef.current = setInterval(fetchAutopilotStrategy, STRATEGY_REFRESH_INTERVAL);
    } else {
         console.log("[Autopilot] Turned OFF. Clearing check cycle.");
        if (strategyIntervalRef.current) {
            clearInterval(strategyIntervalRef.current);
            strategyIntervalRef.current = null;
        }
    }

    // Cleanup on component unmount
    return () => {
        if (strategyIntervalRef.current) {
            clearInterval(strategyIntervalRef.current);
        }
    };
}, [isAutopilotOn, fetchAutopilotStrategy]);


  // Turn off autopilot if connection is lost
  useEffect(() => {
      if(!isConnected && isAutopilotOn) {
          setIsAutopilotOn(false);
          toast({ variant: "destructive", title: "Piloto Automático Desativado", description: "A conexão com a corretora foi perdida." });
      }
  }, [isConnected, isAutopilotOn, toast, setIsAutopilotOn]);


  useEffect(() => {
    if (isAutopilotOn) {
        checkAndExecute();
    }
  }, [isAutopilotOn, checkAndExecute, currentRSI, currentStoch]);
  
  const getActiveIndicatorValue = () => {
    if (!autopilotStrategy) return "N/A";
    if (autopilotStrategy.strategyName === 'RSI_BASIC') return currentRSI?.toFixed(2) ?? "Calculando...";
    if (autopilotStrategy.strategyName === 'STOCH_BASIC') return currentStoch?.toFixed(2) ?? "Calculando...";
    return "N/A";
  }
  const getActiveIndicatorName = () => {
    if (!autopilotStrategy) return "Indicador";
    if (autopilotStrategy.strategyName === 'RSI_BASIC') return "RSI Atual";
    if (autopilotStrategy.strategyName === 'STOCH_BASIC') return "Estocástico Atual";
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
        <div className="space-y-2">
            <Label htmlFor="daily-balance">Banca do Dia (USD)</Label>
            <Input 
                id="daily-balance"
                type="number"
                value={dailyBalance}
                onChange={(e) => setDailyBalance(Number(e.target.value))}
                placeholder="Ex: 1000"
                disabled={isAutopilotOn}
            />
            <p className="text-xs text-muted-foreground">O valor que a IA usará para gestão de risco.</p>
        </div>

        <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-4">
            <span>Requisições à IA (sessão)</span>
            <Badge variant="outline">{geminiRequestCount}</Badge>
        </div>
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
            ) : autopilotStrategy ? (
                <Alert className="bg-primary/5 border-primary/20">
                    <AlertTitle className="text-primary flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Estratégia Ativa: {autopilotStrategy.strategyName}
                    </AlertTitle>
                    <AlertDescription className="text-primary/90 space-y-2 mt-2">
                        <p>{autopilotStrategy.justification}</p>
                        <Separator className="bg-primary/20"/>
                        <p className="font-semibold">Condição: Comprar {autopilotStrategy.direction} se {autopilotStrategy.strategyName === 'RSI_BASIC' ? 'RSI' : 'Estocástico'} {autopilotStrategy.direction === 'RISE' ? '<=' : '>='} {autopilotStrategy.rsiThreshold || autopilotStrategy.stochThreshold}.</p>
                        <div className="text-xs space-y-1">
                            <p>Aposta Sugerida: <strong>${autopilotStrategy.suggestedStake.toFixed(2)}</strong></p>
                            <p>Duração Sugerida: <strong>{autopilotStrategy.suggestedDuration} ticks</strong></p>
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
