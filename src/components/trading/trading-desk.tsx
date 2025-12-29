
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

const ROBOT_PERFORMANCE_KEY = 'derivRobotPerformance';

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

export function TradingDesk() {
    const [performance, setPerformance] = useState<RobotPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const loadPerformance = () => {
            try {
                const storedPerformance = localStorage.getItem(ROBOT_PERFORMANCE_KEY);
                if (storedPerformance) {
                    const performanceData: RobotPerformance[] = JSON.parse(storedPerformance);
                    performanceData.sort((a, b) => b.totalProfit - a.totalProfit);
                    setPerformance(performanceData);
                }
            } catch (error) {
                console.error("Failed to load performance from localStorage", error);
            }
            setLoading(false);
        };
        loadPerformance();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === ROBOT_PERFORMANCE_KEY) {
                loadPerformance();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        }
    }, []);

    const resetPerformance = () => {
        try {
            localStorage.removeItem(ROBOT_PERFORMANCE_KEY);
            setPerformance([]);
            toast({
                title: "Desempenho Resetado",
                description: "O histórico de desempenho da sessão atual foi limpo.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Não foi possível limpar o histórico de desempenho.",
            });
        }
    };

    if (loading) {
        return <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">Carregando...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                    <div>
                        <CardTitle className="font-headline flex items-center gap-2">
                             <LayoutGrid className="w-5 h-5" />
                             Painel de Desempenho dos Analistas
                        </CardTitle>
                        <CardDescription>
                            Resultados em tempo real do conselho de IA.
                        </CardDescription>
                    </div>
                    <Button onClick={resetPerformance} variant="destructive" size="sm">
                        Resetar Desempenho da Sessão
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Estratégia</TableHead>
                            <TableHead>Parâmetros</TableHead>
                            <TableHead className="text-center">Trades</TableHead>
                            <TableHead className="text-center">Taxa de Acerto</TableHead>
                            <TableHead className="text-right">Resultado (USD)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {performance.length > 0 ? (
                            performance.map((robot) => {
                                const totalTrades = robot.wins + robot.losses;
                                const winRate = totalTrades > 0 ? (robot.wins / totalTrades) * 100 : 0;
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
                                                <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4"/>{robot.wins}</span>
                                                <span>/</span>
                                                <span className="flex items-center gap-1 text-red-600">{robot.losses}<XCircle className="h-4 w-4"/></span>
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
                                            robot.totalProfit > 0 ? "text-green-600" : "text-red-600"
                                        )}>
                                            {robot.totalProfit > 0 ? '+' : ''}${robot.totalProfit.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    Nenhum desempenho registrado para esta sessão. Ative a Mesa Operacional.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
