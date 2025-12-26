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
    const { getHistoricalData, isConnected, addMarketDataListener, removeMarketDataListener, wsRef } = useDerivApi();
    
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

            if (activeSubscriptionIdRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                try {
                    await wsRef.current.send(JSON.stringify({ forget: activeSubscriptionIdRef.current }));
                } catch (e) {
                    console.warn('[Market] Erro ao cancelar subscrição anterior:', e);
                }
                activeSubscriptionIdRef.current = null;
            }

            await new Promise(resolve => setTimeout(resolve, 150));
            if (isCancelled) return;

            try {
                const historyData = await getHistoricalData(activeSymbol, chartType === 'Candle' ? timePeriod : undefined, 1000);
                if (isCancelled) return;
                
                setChartData(historyData);
                setIsChartLoading(false);
                isLoadingRef.current = false;
                
                // Agora, subscreve ao stream
                let streamRequest: any;
                if(chartType === 'Candle') {
                    streamRequest = {
                        ticks_history: activeSymbol,
                        style: 'candles',
                        granularity: getGranularityForTimePeriod(timePeriod),
                        subscribe: 1
                    };
                } else {
                    streamRequest = {
                        ticks: activeSymbol,
                        subscribe: 1
                    };
                }
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify(streamRequest));
                }

            } catch (error: any) {
                if (!isCancelled && currentSymbolRef.current === activeSymbol) {
                    console.error('[Market] ERRO ao buscar dados ou subscrever:', error);
                    setChartError(error.message || 'Erro ao carregar dados do gráfico');
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
                try {
                    wsRef.current.send(JSON.stringify({ forget: activeSubscriptionIdRef.current }));
                } catch (e) {
                    // O websocket pode já estar fechado, ignore o erro
                }
            }
        };
    }, [activeSymbol, isConnected, timePeriod, chartType, getHistoricalData, wsRef]);

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
