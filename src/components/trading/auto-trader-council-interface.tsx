

'use client';

import { useState, Fragment } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Users, Bot, Info, BrainCircuit, CheckCircle, XCircle, HelpCircle, CandlestickChart, Activity, Waves, Cloud, BarChart, TrendingUp, Award } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import type { RobotStrategy } from "@/ai/flows/strategy-council-flow.types";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { useFormContext } from "react-hook-form";
import type { RiseFallFormValues } from "./deriv-trader-interface.types";
import { useRobotCouncil } from "@/hooks/use-robot-council";

const indicatorIcons: { [key: string]: React.ReactNode } = {
    RSI: <BrainCircuit className="h-4 w-4" />,
    STOCHASTIC: <BrainCircuit className="h-4 w-4" />,
    MOVING_AVERAGE_CROSS: <Activity className="h-4 w-4" />,
    BOLLINGER_BANDS: <Waves className="h-4 w-4" />,
    MACD_CROSS: <Activity className="h-4 w-4" />,
    PRICE_ACTION_PATTERN: <CandlestickChart className="h-4 w-4" />,
    ADX_TREND: <TrendingUp className="h-4 w-4" />,
    ICHIMOKU_CLOUD: <Cloud className="h-4 w-4" />,
    AWESOME_OSCILLATOR: <BarChart className="h-4 w-4" />,
    VOLUME_PROFILE: <Activity className="h-4 w-4" />,
};

const voteIcons: { [key: string]: React.ReactNode } = {
    RISE: <CheckCircle className="h-4 w-4 text-green-500" />,
    FALL: <XCircle className="h-4 w-4 text-red-500" />,
    HOLD: <HelpCircle className="h-4 w-4 text-yellow-500" />,
}

const robotCategories: Record<string, RobotStrategy['strategyType'][]> = {
    'Especialistas em Momentum': ['RSI', 'STOCHASTIC', 'MACD_CROSS', 'AWESOME_OSCILLATOR'],
    'Especialistas em Tendência': ['MOVING_AVERAGE_CROSS', 'ADX_TREND', 'ICHIMOKU_CLOUD'],
    'Especialistas em Volatilidade': ['BOLLINGER_BANDS'],
    'Especialistas em Padrões': ['PRICE_ACTION_PATTERN'],
    'Especialistas em Volume': ['VOLUME_PROFILE'],
};


export function AutoTraderCouncilInterface() {
  const { toast } = useToast();
  const form = useFormContext<RiseFallFormValues>();
  const robotCouncil = useRobotCouncil();
  
  const {
      isCouncilAutopilotOn,
      setIsCouncilAutopilotOn,
      strategyCouncil,
      isFetchingCouncil,
      councilVotes,
      geminiRequestCount,
      dailyBalance,
      setDailyBalance,
      dailyTarget,
      setDailyTarget,
      consensusThreshold,
      setConsensusThreshold,
      isDynamicConsensusOn,
      setIsDynamicConsensusOn,
      isMeritocracyOn,
      setIsMeritocracyOn,
      indicators,
  } = robotCouncil;
  
  const handleToggleAutopilot = (isOn: boolean) => {
    if (isOn) {
        setIsCouncilAutopilotOn(true);
    } else {
        setIsCouncilAutopilotOn(false);
    }
  };

  const renderStrategyParams = (robot: RobotStrategy) => {
    switch (robot.strategyType) {
        case 'RSI':
        case 'STOCHASTIC':
            return `Sinal Forte < ${robot.strongBuyThreshold}, Sinal Fraco < ${robot.weakBuyThreshold}`;
        case 'MOVING_AVERAGE_CROSS':
            return `Cruzamento de Médias ${robot.shortPeriod}/${robot.longPeriod}`;
        case 'BOLLINGER_BANDS':
            return `Período: ${robot.period}, Desvio Padrão: ${robot.stdDev}`;
        case 'MACD_CROSS':
            return `Parâmetros: ${robot.fastPeriod}/${robot.slowPeriod}/${robot.signalPeriod}`;
        case 'PRICE_ACTION_PATTERN':
            const pattern = robot.pattern === 'hammer' ? 'Martelo' : 'Estrela Cadente';
            return `Padrão: ${pattern}`;
        case 'ADX_TREND':
            return `Limiar de Tendência > ${robot.trendStrengthThreshold}`;
        case 'ICHIMOKU_CLOUD':
            return "Análise da Nuvem";
        case 'AWESOME_OSCILLATOR':
            return "Cruzamento de Zero";
        case 'VOLUME_PROFILE':
            return `POC de ${robot.profileBars} barras`;
        default:
            return "Parâmetros desconhecidos";
    }
  }

  const renderIndicatorValue = (robot: RobotStrategy) => {
    switch (robot.strategyType) {
        case 'RSI':
            return <p>RSI Atual: <strong>{indicators.rsi?.toFixed(2) ?? "..."}</strong></p>;
        case 'STOCHASTIC':
            return <p>Estocástico Atual: <strong>{indicators.stoch?.toFixed(2) ?? "..."}</strong></p>;
        case 'MOVING_AVERAGE_CROSS':
            const shortMA = indicators.ma.short?.toFixed(4) ?? "-";
            const longMA = indicators.ma.long?.toFixed(4) ?? "-";
            return <p>Médias Atuais: <strong>{shortMA} / {longMA}</strong></p>;
        case 'BOLLINGER_BANDS':
            if (!indicators.bollingerBands || indicators.bollingerBands.length === 0) return <p>Bandas: <strong>...</strong></p>;
            const lastBand = indicators.bollingerBands[indicators.bollingerBands.length - 1];
            if (!lastBand) return <p>Bandas: <strong>...</strong></p>;
            return <p>Bandas: <strong>{lastBand.lower.toFixed(4)} / {lastBand.upper.toFixed(4)}</strong></p>;
        case 'MACD_CROSS':
            if (!indicators.macd) return <p>MACD: <strong>...</strong></p>;
            const { macd, signal } = indicators.macd;
            return <p>MACD/Sinal: <strong>{macd?.toFixed(4) ?? '...'} / {signal?.toFixed(4) ?? '...'}</strong></p>;
        case 'PRICE_ACTION_PATTERN':
             return <p>Último Padrão: <strong>{indicators.priceAction || "Nenhum"}</strong></p>;
        case 'ADX_TREND':
            return <p>Força da Tendência (ADX): <strong>{indicators.adx?.toFixed(2) ?? "..."}</strong></p>;
        case 'ICHIMOKU_CLOUD':
            return <p>Ichimoku: <strong>{indicators.ichimoku ? (indicators.ichimoku.inCloud ? 'Na Nuvem' : indicators.ichimoku.trend) : '...'}</strong></p>;
        case 'AWESOME_OSCILLATOR':
            return <p>AO: <strong>{indicators.awesomeOscillator?.toFixed(4) ?? '...'}</strong></p>;
        case 'VOLUME_PROFILE':
            return <p>POC: <strong>{indicators.volumePoc?.toFixed(4) ?? '...'}</strong></p>;
        default:
            return null;
    }
  }

  const groupedRobots = strategyCouncil.reduce((acc, robot) => {
    for (const category in robotCategories) {
        if (robotCategories[category].includes(robot.strategyType)) {
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(robot);
            break;
        }
    }
    return acc;
  }, {} as Record<string, RobotStrategy[]>);


  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Mesa Operacional de IA
            </CardTitle>
            <div className="flex items-center space-x-2">
                <Switch id="council-autopilot-switch" checked={isCouncilAutopilotOn} onCheckedChange={handleToggleAutopilot}/>
                <Label htmlFor="council-autopilot-switch">{isCouncilAutopilotOn ? "Ativado" : "Desativado"}</Label>
            </div>
        </div>
        <CardDescription>
          Um conselho de 10 analistas vota e 3 supervisores de risco aprovam cada trade.
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
        
        <Separator />
        
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="dynamic-consensus-switch" className="flex-1">Consenso Dinâmico</Label>
                <Switch id="dynamic-consensus-switch" checked={isDynamicConsensusOn} onCheckedChange={setIsDynamicConsensusOn} disabled={isCouncilAutopilotOn} />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="meritocracy-switch" className="flex-1">Meritocracia (Peso de Voto)</Label>
                <Switch id="meritocracy-switch" checked={isMeritocracyOn} onCheckedChange={setIsMeritocracyOn} disabled={isCouncilAutopilotOn} />
            </div>
        </div>


         <div className="space-y-2">
            <Label htmlFor="council-consensus">
                Limiar de Consenso
                {isDynamicConsensusOn && <span className="text-muted-foreground text-xs"> (Automático)</span>}
            </Label>
            <Input 
                id="council-consensus"
                type="number"
                min={100}
                max={1000}
                value={consensusThreshold}
                onChange={(e) => {
                    const val = Math.max(100, Math.min(1000, Number(e.target.value)));
                    setConsensusThreshold(val);
                }}
                placeholder="Ex: 300"
                disabled={isCouncilAutopilotOn || isDynamicConsensusOn}
            />
            <p className="text-xs text-muted-foreground">Soma de confiança necessária para executar uma ordem.</p>
        </div>

         <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-4">
            <span>Requisições à IA (sessão)</span>
            <Badge variant="outline">{geminiRequestCount}</Badge>
        </div>

        {isCouncilAutopilotOn && (
            isFetchingCouncil ? (
                <div className="flex items-center justify-center text-muted-foreground p-4">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Convocando o conselho de analistas...</span>
                </div>
            ) : strategyCouncil.length > 0 ? (
                <Alert className="bg-primary/5 border-primary/20 max-h-96 overflow-y-auto">
                    <AlertTitle className="text-primary flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Conselho em Sessão
                    </AlertTitle>
                    <AlertDescription className="text-primary/90 space-y-3 mt-2">
                         {Object.entries(groupedRobots).map(([category, robots]) => (
                            <div key={category}>
                                <h4 className="font-semibold text-sm text-primary/100 mb-2">{category}</h4>
                                {robots.map((robot, index) => {
                                    const voteData = councilVotes[robot.id];
                                    const vote = voteData?.vote || 'HOLD';
                                    const weight = voteData?.weight || 1.0;
                                    const confidence = voteData?.confidence || 0;
                                    return (
                                        <Fragment key={robot.id}>
                                            <div className="text-xs space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <p className="font-bold flex items-center gap-1.5">{indicatorIcons[robot.strategyType] || <Bot />} Analista de {robot.strategyType}</p>
                                                    {isMeritocracyOn && weight > 1.0 && (
                                                        <Badge variant="secondary" className="flex items-center gap-1 text-amber-600 border-amber-500/50">
                                                            <Award className="h-3 w-3" />
                                                            x{weight.toFixed(1)}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="italic pl-5">{robot.justification}</p>
                                                <div className="pl-5 text-xs">{renderStrategyParams(robot)}</div>
                                                <div className="pl-5 text-xs">{renderIndicatorValue(robot)}</div>
                                                <div className={cn("pl-5 font-bold flex items-center gap-1",
                                                    vote === 'RISE' && 'text-green-600',
                                                    vote === 'FALL' && 'text-red-600',
                                                    vote === 'HOLD' && 'text-yellow-600',
                                                )}>
                                                    Voto Atual: {vote} {voteIcons[vote]}
                                                    {confidence > 0 && <span className="font-normal">(Conf: {confidence})</span>}
                                                </div>
                                            </div>
                                            {index < robots.length - 1 && <Separator className="bg-primary/10 my-2" />}
                                        </Fragment>
                                    )
                                })}
                                <Separator className="bg-primary/20 mt-3" />
                            </div>
                        ))}
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
                <p className="text-sm">A Mesa Operacional de IA está desativada.</p>
                <p className="text-xs">Ative para começar a negociar por consenso.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
