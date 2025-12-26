'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDerivApi } from './use-deriv-api';

/* =========================================================
   TYPES
========================================================= */
export type TimePeriod = '1m' | '2m' | '3m' | '5m' | '10m' | '15m' | '30m' | '1h' | '8h' | '1d';
export type ChartType = 'Area' | 'Candle';

export interface BaseData {
  epoch: number;
  price: number;
}
export interface TickData extends BaseData {}
export interface CandleData extends BaseData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
export type ChartData = TickData | CandleData;


/* =========================================================
   HELPERS
========================================================= */
const MAX_DATA_POINTS = 1000;

const validateNumber = (val: any, fallback = 0): number => {
    const num = Number(val);
    return isFinite(num) ? num : fallback;
};

const addDataPoint = (prevData: ChartData[], newPoint: ChartData): ChartData[] => {
    const data = [...prevData];
    if (data.length >= MAX_DATA_POINTS) {
        data.shift();
    }
    data.push(newPoint);
    return data;
};

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 60;
        case '2m': return 120;
        case '3m': return 180;
        case '5m': return 300;
        case '10m': return 600;
        case '15m': return 900;
        case '30m': return 1800;
        case '1h': return 3600;
        case '8h': return 28800;
        case '1d': return 86400;
        default: return 60;
    }
}


/* =========================================================
   HOOK PRINCIPAL
========================================================= */
export function useMarketData(activeSymbol: string | null, defaultTimePeriod: TimePeriod = '5m') {
    const { makeRequest, isConnected, addMarketDataListener, removeMarketDataListener, wsRef } = useDerivApi();
    
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(true);
    const [chartError, setChartError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('Area');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>(defaultTimePeriod);

    const activeSubscriptionIdRef = useRef<string | null>(null);
    const currentSymbolRef = useRef<string | null>(null);
    const currentChartTypeRef = useRef<ChartType>(chartType);
    const isLoadingRef = useRef(false);

    // Atualiza refs
    useEffect(() => {
        currentChartTypeRef.current = chartType;
    }, [chartType]);

    // --------------------------------------------------------------------------
    // PROCESSAMENTO DE MENSAGENS
    // --------------------------------------------------------------------------
    const handleMessage = useCallback((response: any) => {
        // Ignora durante carregamento inicial
        if (isLoadingRef.current) return;

        // Valida símbolo
        const msgSymbol = response.tick?.symbol || response.ohlc?.symbol;
        if (msgSymbol && msgSymbol !== currentSymbolRef.current) return;

        // Erros
        if (response.error) {
            console.error('[Market] Erro:', response.error);
            return;
        }

        // Subscription ID
        if (response.subscription?.id) {
            activeSubscriptionIdRef.current = response.subscription.id;
        }

        // OHLC updates (candles)
        if (response.msg_type === 'ohlc' && currentChartTypeRef.current === 'Candle') {
            const ohlc = response.ohlc;
            const newCandle: CandleData = {
                epoch: ohlc.open_time,
                open: validateNumber(ohlc.open),
                high: validateNumber(ohlc.high),
                low: validateNumber(ohlc.low),
                close: validateNumber(ohlc.close),
                price: validateNumber(ohlc.close)
            };

            setChartData(prev => {
                const lastCandle = prev[prev.length - 1] as CandleData;
                if (lastCandle && lastCandle.epoch === newCandle.epoch) {
                    return [...prev.slice(0, -1), newCandle];
                }
                return addDataPoint(prev, newCandle);
            });
        }
        
        // Tick updates (area)
        else if (response.msg_type === 'tick' && currentChartTypeRef.current === 'Area') {
            const tick = response.tick;
            const newTick: TickData = {
                epoch: tick.epoch,
                price: validateNumber(tick.quote)
            };

            if (newTick.price > 0) {
                setChartData(prev => addDataPoint(prev, newTick));
            }
        }
    }, []);

    // --------------------------------------------------------------------------
    // LISTENER
    // --------------------------------------------------------------------------
    useEffect(() => {
        addMarketDataListener(handleMessage);
        return () => removeMarketDataListener(handleMessage);
    }, [addMarketDataListener, removeMarketDataListener, handleMessage]);

    // --------------------------------------------------------------------------
    // SUBSCRIÇÃO
    // --------------------------------------------------------------------------
    useEffect(() => {
        let isCancelled = false;

        const subscribe = async () => {
            if (!isConnected || !activeSymbol) {
                setChartData([]);
                setIsChartLoading(!activeSymbol);
                return;
            }

            isLoadingRef.current = true;
            currentSymbolRef.current = activeSymbol;
            
            setChartData([]);
            setIsChartLoading(true);
            setChartError(null);

            // Cancela subscrição anterior
            if (activeSubscriptionIdRef.current) {
                try {
                    await makeRequest({ forget: activeSubscriptionIdRef.current });
                } catch (e) {
                    console.warn('[Market] Erro ao cancelar:', e);
                }
                activeSubscriptionIdRef.current = null;
            }

            await new Promise(resolve => setTimeout(resolve, 150));
            if (isCancelled) return;

            try {
                if (chartType === 'Candle') {
                    // ============ CANDLES ============
                    const granularity = getGranularityForTimePeriod(timePeriod);
                    
                    // 1. Buscar histórico SEM subscribe
                    const historyResponse = await makeRequest({
                        ticks_history: activeSymbol,
                        granularity,
                        style: 'candles',
                        count: 1000
                    });

                    if (isCancelled) return;

                    // Processar candles
                    if (historyResponse.candles) {
                        const candles: CandleData[] = historyResponse.candles.map((c: any) => ({
                            epoch: c.epoch,
                            open: validateNumber(c.open),
                            high: validateNumber(c.high),
                            low: validateNumber(c.low),
                            close: validateNumber(c.close),
                            price: validateNumber(c.close)
                        }));
                        setChartData(candles);
                    }

                    setIsChartLoading(false);
                    isLoadingRef.current = false;

                    // 2. Subscrever para updates COM subscribe
                    await makeRequest({
                        ticks_history: activeSymbol,
                        granularity,
                        style: 'candles',
                        subscribe: 1
                    });

                } else {
                    // ============ TICKS ============
                    
                    // 1. Buscar histórico SEM subscribe
                    const historyResponse = await makeRequest({
                        ticks_history: activeSymbol,
                        style: 'ticks',
                        end: 'latest',
                        count: 1000,
                    });

                    if (isCancelled) return;

                    // Processar ticks
                    if (historyResponse.history) {
                        const { prices, times } = historyResponse.history;
                        const ticks: TickData[] = prices
                            .map((p: number, i: number) => ({
                                epoch: times[i],
                                price: validateNumber(p)
                            }))
                            .filter((t: TickData) => t.price > 0);
                        setChartData(ticks);
                    }

                    setIsChartLoading(false);
                    isLoadingRef.current = false;

                    // 2. Subscrever para updates COM subscribe
                    await makeRequest({
                        ticks: activeSymbol,
                        subscribe: 1
                    });
                }

            } catch (error: any) {
                if (!isCancelled && currentSymbolRef.current === activeSymbol) {
                    console.error('[Market] ERRO:', error);
                    setChartError(error.message || 'Erro ao carregar dados');
                    setIsChartLoading(false);
                    isLoadingRef.current = false;
                }
            }
        };

        subscribe();

        return () => {
            isCancelled = true;
            isLoadingRef.current = false;
            
            if (activeSubscriptionIdRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                makeRequest({ forget: activeSubscriptionIdRef.current })
                    .catch(e => console.error('[Market] Erro no cleanup:', e));
            }
        };
    }, [activeSymbol, isConnected, timePeriod, chartType]);

    return {
        chartData,
        isChartLoading,
        chartError,
        chartType,
        setChartType,
        timePeriod,
        setTimePeriod,
    };
}
