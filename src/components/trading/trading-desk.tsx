
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';
import { BrainCircuit, Activity, Waves, CandlestickChart, Bot, LayoutGrid, BarChart, TrendingUp, Cloud, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { RobotPerformance } from './operations-log.types';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';

interface TradingDeskProps {
    isMeritocracyOn: boolean;
    setIsMeritocracyOn: (isOn: boolean) => void;
    isCouncilAutopilotOn: boolean;
    robotPerformance: RobotPerformance[];
}

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
    KAMA: <Activity className="h-4 w-4" />,
    VWAP: <Activity className="h-4 w-4" />,
    Z_SCORE: <BrainCircuit className="h-4 w-4" />,
    STOCH_RSI: <BrainCircuit className="h-4 w-4" />,
    MFI: <BrainCircuit className="h-4 w-4" />,
    TRIX: <Activity className="h-4 w-4" />,
    ROC: <Activity className="h-4 w-4" />,
    DONCHIAN_CHANNELS: <Waves className="h-4 w-4" />,
    RVI: <BrainCircuit className="h-4 w-4" />,
    PARABOLIC_SAR: <TrendingUp className="h-4 w-4" />,
    CHANDELIER_EXIT: <TrendingUp className="h-4 w-4" />,
    OBV: <Activity className="h-4 w-4" />,
};

function renderStrategyParams(robot: RobotStrategy) {
     switch (robot.strategyType) {
        case 'RSI':
        case 'STOCHASTIC':
        case 'MFI':
        case 'RVI':
            return `Forte < ${robot.strongBuyThreshold}, Fraco < ${robot.weakBuyThreshold}`;
        case 'STOCH_RSI':
             return `Forte < ${robot.strongBuyThreshold?.toFixed(2)}, Fraco < ${robot.weakBuyThreshold?.toFixed(2)}`;
        case 'MOVING_AVERAGE_CROSS':
            return `Cruzamento ${robot.shortPeriod}/${robot.longPeriod}`;
        case 'BOLLINGER_BANDS':
            return `Período: ${robot.period}, Desvio Padrão: ${robot.stdDev}`;
        case 'MACD_CROSS':
            return `Parâmetros: ${robot.fastPeriod}/${robot.slowPeriod}/${robot.signalPeriod}`;
        case 'PRICE_ACTION_PATTERN':
            const pattern = robot.pattern === 'hammer' ? 'Martelo' : 'Estrela Cadente';
            return `Padrão: ${pattern}`;
        case 'ADX_TREND':
            return `Limiar de Tendência > ${robot.trendStrengthThreshold}`;
        case 'VOLUME_PROFILE':
            return `POC de ${robot.profileBars} barras`;
        case 'Z_SCORE':
            return `Limiar Z-Score: ${robot.zScoreThreshold}`;
        case 'PARABOLIC_SAR':
            return `AF: ${robot.acceleration}, MAX: ${robot.maxAcceleration}`;
        case 'CHANDELIER_EXIT':
            return `Multiplicador ATR: ${robot.multiplier}`;
        case 'TRIX':
        case 'ROC':
        case 'KAMA':
        case 'DONCHIAN_CHANNELS':
            return `Período: ${robot.period}`;
        case 'AWESOME_OSCILLATOR':
        case 'ICHIMOKU_CLOUD':
        case 'VWAP':
        case 'OBV':
             return 'Parâmetros Internos';
        default:
            return "N/A";
    }
}

export function TradingDesk({ isMeritocracyOn, setIsMeritocracyOn, isCouncilAutopilotOn, robotPerformance }: TradingDeskProps) {
    const { toast } = useToast();

    // The robotPerformance prop now directly comes from the parent hook, ensuring it's always up-to-date.
    const sortedPerformance = [...robotPerformance].sort((a, b) => (b.wins || 0) - (a.wins || 0));

    const resetPerformance = () => {
        try {
            localStorage.removeItem(ROBOT_PERFORMANCE_KEY);
            // This is tricky because the parent owns the state. A better way would be to call a function passed via props.
            // For now, we rely on the parent to re-initialize it when the council is formed.
            // A page reload might be the simplest way to reflect this reset if not.
            window.location.reload(); 
            toast({
                title: "Desempenho Resetado",
                description: "O histórico da arena foi limpo. A página será recarregada.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Não foi possível limpar o histórico de desempenho.",
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <CardTitle className="font-headline flex items-center gap-2">
                             <LayoutGrid className="w-5 h-5" />
                             Arena Virtual: Painel de Desempenho
                        </CardTitle>
                        <CardDescription>
                            O placar da Arena Virtual. Cada robô compete continuamente, e o seu desempenho alimenta o modo Meritocracia.
                        </CardDescription>
                    </div>
                     <div className="flex items-center space-x-2 rounded-lg border p-3 shadow-sm shrink-0">
                        <div className="space-y-0.5">
                            <Label htmlFor="meritocracy-switch-desk" className="font-semibold">Modo Meritocracia</Label>
                            <p className="text-xs text-muted-foreground">
                                Pondera os votos pelo desempenho.
                            </p>
                        </div>
                        <Switch 
                            id="meritocracy-switch-desk" 
                            checked={isMeritocracyOn}
                            onCheckedChange={setIsMeritocracyOn}
                            disabled={!isCouncilAutopilotOn}
                        />
                    </div>
                </div>
                 <Separator className="my-4" />
                 <Button onClick={resetPerformance} variant="destructive" size="sm" className="w-full sm:w-auto">
                    Resetar Desempenho da Sessão
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Estratégia</TableHead>
                            <TableHead>Parâmetros</TableHead>
                            <TableHead className="text-center">Trades (V/D)</TableHead>
                            <TableHead className="text-center">Taxa de Acerto</TableHead>
                            <TableHead className="text-right">Resultado (USD)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedPerformance.length > 0 ? (
                            sortedPerformance.map((robot) => {
                                const totalTrades = (robot.wins || 0) + (robot.losses || 0);
                                const winRate = totalTrades > 0 ? ((robot.wins || 0) / totalTrades) * 100 : 0;
                                return (
                                    <TableRow key={robot.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {indicatorIcons[robot.strategyType] || <Bot />}
                                                <span>{robot.strategyType}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{renderStrategyParams(robot.strategy)}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4"/>{robot.wins || 0}</span>
                                                <span>/</span>
                                                <span className="flex items-center gap-1 text-red-600">{robot.losses || 0}<XCircle className="h-4 w-4"/></span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {totalTrades > 0 ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <span>{winRate.toFixed(1)}%</span>
                                                    <Progress value={winRate} className="w-20 h-2" indicatorClassName={winRate >= 50 ? 'bg-green-500' : 'bg-red-500'} />
                                                </div>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className={cn(
                                            "text-right font-bold",
                                            (robot.totalProfit || 0) > 0 ? "text-green-600" : (robot.totalProfit || 0) < 0 ? "text-red-600" : "text-muted-foreground"
                                        )}>
                                            {(robot.totalProfit || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    Nenhum desempenho registrado. Ative a Mesa Operacional para iniciar a simulação.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
