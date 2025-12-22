'use client';

import { useState, useCallback, Fragment } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Users, Bot, Power, Info, ChevronRight, BrainCircuit, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { useToast } from "@/hooks/use-toast";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import type { RobotStrategy } from "@/ai/flows/strategy-council-flow.types";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

const indicatorIcons: { [key: string]: React.ReactNode } = {
    RSI: <BrainCircuit className="h-4 w-4" />,
    STOCHASTIC: <BrainCircuit className="h-4 w-4" />,
    MOVING_AVERAGE_CROSS: <BrainCircuit className="h-4 w-4" />,
};

const voteIcons: { [key: string]: React.ReactNode } = {
    RISE: <CheckCircle className="h-4 w-4 text-green-500" />,
    FALL: <XCircle className="h-4 w-4 text-red-500" />,
    HOLD: <HelpCircle className="h-4 w-4 text-yellow-500" />,
}


export function AutoTraderCouncilInterface() {
  const { toast } = useToast();
  const { 
    isConnected, 
    isCouncilAutopilotOn,
    setIsCouncilAutopilotOn,
    strategyCouncil,
    fetchStrategyCouncil,
    isFetchingCouncil,
    councilVotes,
    geminiRequestCount,
    dailyBalance,
    setDailyBalance,
    dailyTarget,
    setDailyTarget,
    currentRSI,
    currentStoch,
    currentMA,
  } = useDerivApi();
  
  const handleToggleAutopilot = (isOn: boolean) => {
    if (isOn) {
        if (!isConnected) {
            toast({ variant: "destructive", title: "Piloto Automático", description: "Conecte-se à corretora antes de ativar o conselho." });
            return;
        }
        setIsCouncilAutopilotOn(true);
        fetchStrategyCouncil();
    } else {
        setIsCouncilAutopilotOn(false);
    }
  };

  const renderStrategyParams = (robot: RobotStrategy) => {
    switch (robot.strategyType) {
        case 'RSI':
            return `Compra < ${robot.buyThreshold}, Venda > ${robot.sellThreshold}`;
        case 'STOCHASTIC':
            return `Compra < ${robot.buyThreshold}, Venda > ${robot.sellThreshold}`;
        case 'MOVING_AVERAGE_CROSS':
            return `Cruzamento de Médias ${robot.shortPeriod}/${robot.longPeriod}`;
        default:
            return "Parâmetros desconhecidos";
    }
  }

  const renderIndicatorValue = (robot: RobotStrategy) => {
    let value: string | React.ReactNode = "N/A";
    switch (robot.strategyType) {
        case 'RSI':
            value = currentRSI?.toFixed(2) ?? "Calculando...";
            return <p>RSI Atual: <strong>{value}</strong></p>;
        case 'STOCHASTIC':
            value = currentStoch?.toFixed(2) ?? "Calculando...";
            return <p>Estocástico Atual: <strong>{value}</strong></p>;
        case 'MOVING_AVERAGE_CROSS':
            const shortMA = currentMA.short?.toFixed(4) ?? "-";
            const longMA = currentMA.long?.toFixed(4) ?? "-";
            return <p>Médias Atuais: <strong>{shortMA} / {longMA}</strong></p>;
        default:
            return null;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Conselho de Robôs
            </CardTitle>
            <div className="flex items-center space-x-2">
                <Switch id="council-autopilot-switch" checked={isCouncilAutopilotOn} onCheckedChange={handleToggleAutopilot}/>
                <Label htmlFor="council-autopilot-switch">{isCouncilAutopilotOn ? "Ativado" : "Desativado"}</Label>
            </div>
        </div>
        <CardDescription>
          Um conselho de IAs vota em cada trade. Uma ordem só é executada se houver consenso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="council-daily-balance">Banca do Dia (USD)</Label>
                <Input 
                    id="council-daily-balance"
                    type="number"
                    value={dailyBalance}
                    onChange={(e) => setDailyBalance(Number(e.target.value))}
                    placeholder="Ex: 100"
                    disabled={isCouncilAutopilotOn}
                />
                <p className="text-xs text-muted-foreground">Sua perda máxima no dia.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="council-daily-target">Alvo de Lucro (USD)</Label>
                <Input 
                    id="council-daily-target"
                    type="number"
                    value={dailyTarget}
                    onChange={(e) => setDailyTarget(Number(e.target.value))}
                    placeholder="Ex: 50"
                    disabled={isCouncilAutopilotOn}
                />
                <p className="text-xs text-muted-foreground">Sua meta de lucro no dia.</p>
            </div>
        </div>

         <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-4">
            <span>Requisições à IA (sessão)</span>
            <Badge variant="outline">{geminiRequestCount}</Badge>
        </div>

        {isCouncilAutopilotOn && (
            isFetchingCouncil ? (
                <div className="flex items-center justify-center text-muted-foreground p-4">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Convocando o conselho de robôs...</span>
                </div>
            ) : strategyCouncil.length > 0 ? (
                <Alert className="bg-primary/5 border-primary/20">
                    <AlertTitle className="text-primary flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Conselho em Sessão
                    </AlertTitle>
                    <AlertDescription className="text-primary/90 space-y-3 mt-2">
                        {strategyCouncil.map((robot, index) => {
                            const vote = councilVotes[robot.id] || 'HOLD';
                            return (
                            <Fragment key={robot.id}>
                                <div className="text-xs space-y-1">
                                    <p className="font-bold flex items-center gap-1.5">{indicatorIcons[robot.strategyType] || <Bot />} Robô {index + 1}: {robot.strategyType}</p>
                                    <p className="italic pl-5">{robot.justification}</p>
                                    <p className="pl-5">{renderStrategyParams(robot)}</p>
                                    <div className="pl-5">{renderIndicatorValue(robot)}</div>
                                    <div className={cn("pl-5 font-bold flex items-center gap-1", 
                                        vote === 'RISE' && 'text-green-600',
                                        vote === 'FALL' && 'text-red-600',
                                        vote === 'HOLD' && 'text-yellow-600',
                                    )}>
                                        Voto Atual: {vote} {voteIcons[vote]}
                                    </div>
                                </div>
                                {index < strategyCouncil.length - 1 && <Separator className="bg-primary/20"/>}
                           </Fragment>
                        )})}
                    </AlertDescription>
                </Alert>
            ) : (
                 <div className="text-center text-muted-foreground p-4 border rounded-md bg-muted/50">
                    <Info className="h-5 w-5 mx-auto mb-2" />
                    <p className="text-sm">Aguardando geração do conselho pela IA.</p>
                </div>
            )
        )}
        {!isCouncilAutopilotOn && (
             <div className="text-center text-muted-foreground p-4 border rounded-md bg-muted/50">
                <Info className="h-5 w-5 mx-auto mb-2" />
                <p className="text-sm">O Conselho de Robôs está desativado.</p>
                <p className="text-xs">Ative para começar a negociar por consenso.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
