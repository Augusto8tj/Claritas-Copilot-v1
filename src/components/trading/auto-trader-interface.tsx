

'use client';

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Zap, Bot, Power, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useAutopilot } from "@/hooks/use-autopilot";

export function AutoTraderInterface({ 
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
    currentStoch
}: ReturnType<typeof useAutopilot>) {
  const { toast } = useToast();
  
  const handleToggleAutopilot = (isOn: boolean) => {
    if (isOn) {
        setIsAutopilotOn(true);
    } else {
        setIsAutopilotOn(false);
    }
  };

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
          Defina seus limites e deixe a IA executar uma estratégia de trading para você.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="daily-balance">Banca do Dia (USD)</Label>
                <Input 
                    id="daily-balance"
                    type="number"
                    value={dailyBalance}
                    onChange={(e) => setDailyBalance(Number(e.target.value))}
                    placeholder="Ex: 100"
                    disabled={isAutopilotOn}
                />
                <p className="text-xs text-muted-foreground">Sua perda máxima no dia.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="daily-target">Alvo de Lucro (USD)</Label>
                <Input 
                    id="daily-target"
                    type="number"
                    value={dailyTarget}
                    onChange={(e) => setDailyTarget(Number(e.target.value))}
                    placeholder="Ex: 50"
                    disabled={isAutopilotOn}
                />
                <p className="text-xs text-muted-foreground">Sua meta de lucro no dia.</p>
            </div>
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
