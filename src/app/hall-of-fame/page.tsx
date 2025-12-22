
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { RobotPerformance } from '@/components/trading/operations-log.types';
import { BrainCircuit, Activity, Waves, CandlestickChart, Bot, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RobotStrategy } from '@/ai/flows/strategy-council-flow.types';

const HALL_OF_FAME_KEY = 'derivHallOfFame';
const PROMOTION_THRESHOLD_WINS = 10;
const PROMOTION_THRESHOLD_PROFIT = 0;

const indicatorIcons: { [key: string]: React.ReactNode } = {
    RSI: <BrainCircuit className="h-4 w-4" />,
    STOCHASTIC: <BrainCircuit className="h-4 w-4" />,
    MOVING_AVERAGE_CROSS: <Activity className="h-4 w-4" />,
    BOLLINGER_BANDS: <Waves className="h-4 w-4" />,
    MACD_CROSS: <Activity className="h-4 w-4" />,
    PRICE_ACTION_PATTERN: <CandlestickChart className="h-4 w-4" />,
    ADX_TREND: <BrainCircuit className="h-4 w-4" />,
};

function renderStrategyParams(robot: RobotStrategy) {
    switch (robot.strategyType) {
        case 'RSI':
            return `Compra < ${robot.buyThreshold}, Venda > ${robot.sellThreshold}`;
        case 'STOCHASTIC':
            return `Compra < ${robot.buyThreshold}, Venda > ${robot.sellThreshold}`;
        case 'MOVING_AVERAGE_CROSS':
            return `Cruzamento ${robot.shortPeriod}/${robot.longPeriod}`;
        case 'BOLLINGER_BANDS':
            return `Período: ${robot.period}, Desv. Padrão: ${robot.stdDev}`;
        case 'MACD_CROSS':
            return `Parâmetros: ${robot.fastPeriod}/${robot.slowPeriod}/${robot.signalPeriod}`;
        case 'PRICE_ACTION_PATTERN':
            const pattern = robot.pattern === 'hammer' ? 'Martelo' : 'Estrela Cadente';
            return `Padrão: ${pattern}`;
        case 'ADX_TREND':
            return `Limiar de Força > ${robot.trendStrengthThreshold}`;
        default:
            return "N/A";
    }
}


export default function HallOfFamePage() {
    const [hallOfFame, setHallOfFame] = useState<RobotPerformance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const storedPerformance = localStorage.getItem('derivRobotPerformance');
            if (storedPerformance) {
                const performanceData: RobotPerformance[] = JSON.parse(storedPerformance);
                
                const promotedRobots = performanceData.filter(
                    (p) => p.wins >= PROMOTION_THRESHOLD_WINS && p.totalProfit > PROMOTION_THRESHOLD_PROFIT
                );

                promotedRobots.sort((a, b) => b.totalProfit - a.totalProfit);

                setHallOfFame(promotedRobots);
            }
        } catch (error) {
            console.error("Failed to load Hall of Fame from localStorage", error);
        }
        setLoading(false);
    }, []);

    if (loading) {
        return <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">Carregando...</div>;
    }

    return (
        <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                    <Trophy className="w-8 h-8 text-amber-500" />
                    Hall da Fama dos Robôs
                </h1>
            </div>
            <p className="text-muted-foreground">
                Um registo dos robôs-analistas mais lucrativos e consistentes já criados pelo Conselho de IA.
            </p>

            <Card>
                <CardHeader>
                    <CardTitle>Robôs Lendários</CardTitle>
                    <CardDescription>
                        Apenas robôs com mais de {PROMOTION_THRESHOLD_WINS} vitórias e lucro positivo são elegíveis.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Estratégia</TableHead>
                                <TableHead>Parâmetros</TableHead>
                                <TableHead className="text-center">Vitórias</TableHead>
                                <TableHead className="text-center">Derrotas</TableHead>
                                <TableHead className="text-right">Lucro Total (USD)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {hallOfFame.length > 0 ? (
                                hallOfFame.map((robot) => (
                                    <TableRow key={robot.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {indicatorIcons[robot.strategy.strategyType] || <Bot />}
                                                <span>{robot.strategy.strategyType}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{renderStrategyParams(robot.strategy)}</TableCell>
                                        <TableCell className="text-center font-semibold text-green-600">{robot.wins}</TableCell>
                                        <TableCell className="text-center font-semibold text-red-600">{robot.losses}</TableCell>
                                        <TableCell className={cn(
                                            "text-right font-bold",
                                            robot.totalProfit > 0 ? "text-green-600" : "text-red-600"
                                        )}>
                                            ${robot.totalProfit.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        Nenhum robô foi promovido ao Hall da Fama ainda.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
