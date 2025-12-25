
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
  price: number; // For line/area charts, this is the main value
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
        default: return 60; // Default to 1 minute
    }
}


/* =========================================================
   HOOK PRINCIPAL
========================================================= */
export function useMarketData(activeSymbol: string | null) {
    const { makeRequest, isConnected, addMarketDataListener, removeMarketDataListener } = useDerivApi();
    
    // Estados visuais
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(true);
    const [chartError, setChartError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('Area');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('1m');

    // Refs de Controle
    const activeSubscriptionIdRef = useRef<string | null>(null);
    const currentSymbolRef = useRef<string | null>(null);
    const isSwitchingRef = useRef(false);

    // --------------------------------------------------------------------------
    // 1. Lógica de Processamento de Dados
    // --------------------------------------------------------------------------
    const handleMarketData = useCallback((response: any) => {
        if (isSwitchingRef.current) return;
        
        const responseSymbol = response.tick?.symbol || response.ohlc?.symbol || response.echo_req?.ticks_history;
        if (responseSymbol && responseSymbol !== currentSymbolRef.current) {
            return; // Ignora dados de uma subscrição antiga
        }

        if (response.error) {
            if (responseSymbol === currentSymbolRef.current && response.error.code !== 'AlreadySubscribed') {
                setChartError(response.error.message);
                setIsChartLoading(false);
            }
            return;
        }

        // --- Handle Subscription ID ---
        if (response.subscription?.id) {
             activeSubscriptionIdRef.current = response.subscription.id;
        }

        if (response.msg_type === 'candles') {
            const candles: CandleData[] = (response.candles || []).map((c: any) => ({
                epoch: c.epoch,
                open: validateNumber(c.open),
                high: validateNumber(c.high),
                low: validateNumber(c.low),
                close: validateNumber(c.close),
                price: validateNumber(c.close)
            }));
            setChartData(candles);
            setIsChartLoading(false);
        }
        else if (response.msg_type === 'history') {
            const { prices, times } = response.history;
            const formatted: TickData[] = prices.map((p: number, i: number) => ({
                epoch: times[i],
                price: validateNumber(p)
            })).filter((d: TickData) => d.price > 0);
            
            // This is the pre-population step.
            setChartData(formatted);
            setIsChartLoading(false);
        }
        else if (response.msg_type === 'ohlc') {
            const candle = response.ohlc;
            if(candle.symbol !== currentSymbolRef.current) return;

            const newCandle: CandleData = {
                epoch: candle.open_time,
                open: validateNumber(candle.open),
                high: validateNumber(candle.high),
                low: validateNumber(candle.low),
                close: validateNumber(candle.close),
                price: validateNumber(candle.close)
            };
            setChartData(prev => {
                const data = prev as CandleData[];
                if (data.length > 0 && data[data.length - 1].epoch === newCandle.epoch) {
                    const newData = [...data];
                    newData[newData.length - 1] = newCandle;
                    return newData;
                }
                return addDataPoint(data, newCandle);
            });
        }
        else if (response.msg_type === 'tick') {
            const tick = response.tick;
            if(tick.symbol !== currentSymbolRef.current) return;
            
            const newTick: TickData = { epoch: tick.epoch, price: validateNumber(tick.quote) };
            if (newTick.price === 0) return;
            
            // This is the real-time update step.
            setChartData(prev => addDataPoint(prev, newTick));
        }

    }, []);

    // --------------------------------------------------------------------------
    // 2. Lifecycle do Listener
    // --------------------------------------------------------------------------
    const handleMarketDataRef = useRef(handleMarketData);
    handleMarketDataRef.current = handleMarketData;

    useEffect(() => {
        const handler = (data: any) => handleMarketDataRef.current(data);
        addMarketDataListener(handler);
        return () => removeMarketDataListener(handler);
    }, [addMarketDataListener, removeMarketDataListener]);


    // --------------------------------------------------------------------------
    // 3. Função Centralizada de Subscrição
    // --------------------------------------------------------------------------
    useEffect(() => {
        const subscribeToSymbol = async () => {
            if (!isConnected || !activeSymbol) {
                setChartData([]);
                setIsChartLoading(!activeSymbol);
                return;
            }
            
            isSwitchingRef.current = true;
            currentSymbolRef.current = activeSymbol;
            
            setChartData([]); 
            setIsChartLoading(true);
            setChartError(null);

            if (activeSubscriptionIdRef.current) {
                try {
                    await makeRequest({ forget: activeSubscriptionIdRef.current });
                } catch (e) {
                    console.warn(`Falha ao cancelar subscrição ${activeSubscriptionIdRef.current}:`, e);
                }
                activeSubscriptionIdRef.current = null;
            }
            
            await new Promise(resolve => setTimeout(resolve, 50)); 
            isSwitchingRef.current = false;

            try {
                // Request historical data AND subscribe to real-time updates in one go.
                // The API will first send a `history` message, then `tick` messages.
                const style = timePeriod === '1m' ? 'ticks' : 'candles';
                const granularity = style === 'candles' ? getGranularityForTimePeriod(timePeriod) : undefined;

                const request = {
                    ticks_history: activeSymbol,
                    adjust_start_time: 1,
                    count: 1000, 
                    end: 'latest',
                    style: style,
                    granularity: granularity,
                    subscribe: 1,
                };
                
                makeRequest(request);

            } catch (error: any) {
                if(currentSymbolRef.current === activeSymbol) {
                    console.error("[useMarketData] Erro na subscrição:", error);
                    setChartError(error.message || "Erro ao subscrever dados de mercado.");
                    setIsChartLoading(false);
                }
            }
        };

        subscribeToSymbol();
        
        return () => {
            if (activeSubscriptionIdRef.current) {
                makeRequest({ forget: activeSubscriptionIdRef.current }).catch(e => console.error("Cleanup falhou ao cancelar subscrição:", e));
                activeSubscriptionIdRef.current = null;
            }
        };
    }, [activeSymbol, isConnected, timePeriod, makeRequest]);


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
