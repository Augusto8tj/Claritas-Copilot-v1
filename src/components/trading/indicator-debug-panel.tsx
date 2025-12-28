
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartData } from '@/hooks/types';
import type { useRobotCouncil } from '@/hooks/use-robot-council';
import { ServerCrash } from 'lucide-react';

interface IndicatorDebugPanelProps {
  indicators: ReturnType<typeof useRobotCouncil>['indicators'];
  latestDataPoint: ChartData | null;
}

const formatValue = (value: number | null | undefined, precision = 4) => {
    return value !== null && value !== undefined ? value.toFixed(precision) : '...';
};

const isCandle = (d: ChartData): d is { open: number, high: number, low: number, close: number } => 'close' in d;


export function IndicatorDebugPanel({ indicators, latestDataPoint }: IndicatorDebugPanelProps) {
    if (!indicators) return null;

    return (
        <Card className="mt-6 border-amber-500/50 bg-amber-500/5">
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-amber-700">
                    <ServerCrash className="h-5 w-5" />
                    Painel de Depuração de Indicadores
                </CardTitle>
                <CardDescription className="text-amber-600">
                    Valores em tempo real calculados pelo motor da Mesa Operacional.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm font-mono">
                <div className="space-y-1">
                    <h4 className="font-bold text-muted-foreground">API da Deriv (Dados Brutos)</h4>
                    {latestDataPoint && isCandle(latestDataPoint) ? (
                        <>
                            <p>Open: <span className="font-bold text-foreground">{formatValue(latestDataPoint.open)}</span></p>
                            <p>High: <span className="font-bold text-foreground">{formatValue(latestDataPoint.high)}</span></p>
                            <p>Low: <span className="font-bold text-foreground">{formatValue(latestDataPoint.low)}</span></p>
                            <p>Close: <span className="font-bold text-foreground">{formatValue(latestDataPoint.close)}</span></p>
                            <p>Epoch: <span className="font-bold text-foreground">{latestDataPoint.epoch}</span></p>
                        </>
                    ) : latestDataPoint && 'price' in latestDataPoint ? (
                         <p>Price: <span className="font-bold text-foreground">{formatValue(latestDataPoint.price)}</span></p>
                    ): (
                        <p>...</p>
                    )}
                </div>
                 <div className="space-y-1">
                    <h4 className="font-bold text-muted-foreground">Momentum</h4>
                    <p>RSI: <span className="font-bold text-foreground">{formatValue(indicators.rsi)}</span></p>
                    <p>Stochastic: <span className="font-bold text-foreground">{formatValue(indicators.stoch)}</span></p>
                </div>
                 <div className="space-y-1">
                    <h4 className="font-bold text-muted-foreground">Tendência</h4>
                    <p>ADX: <span className="font-bold text-foreground">{formatValue(indicators.adx)}</span></p>
                    <p>+DI: <span className="font-bold text-foreground">{formatValue(indicators.pdi)}</span></p>
                    <p>-DI: <span className="font-bold text-foreground">{formatValue(indicators.ndi)}</span></p>
                </div>
                 <div className="space-y-1">
                    <h4 className="font-bold text-muted-foreground">Volatilidade</h4>
                    <p>ATR: <span className="font-bold text-foreground">{formatValue(indicators.atr)}</span></p>
                </div>
                 <div className="space-y-1">
                    <h4 className="font-bold text-muted-foreground">MACD</h4>
                    <p>macd: <span className="font-bold text-foreground">{formatValue(indicators.macd.macd)}</span></p>
                    <p>signal: <span className="font-bold text-foreground">{formatValue(indicators.macd.signal)}</span></p>
                </div>
                 <div className="space-y-1">
                    <h4 className="font-bold text-muted-foreground">Médias Móveis</h4>
                     <p>MA Curta: <span className="font-bold text-foreground">{formatValue(indicators.ma?.short)}</span></p>
                    <p>MA Longa: <span className="font-bold text-foreground">{formatValue(indicators.ma?.long)}</span></p>
                </div>
            </CardContent>
        </Card>
    );
}
