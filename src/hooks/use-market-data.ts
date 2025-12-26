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
    const { makeRequest, isConnected, addMarketDataListener, removeMarketDataListener } = useDerivApi();
    
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(true);
    const [chartError, setChartError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('Area');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>(defaultTimePeriod);

    const activeSubscriptionIdRef = useRef<string | null>(null);
    const currentSymbolRef = useRef<string | null>(null);
    const isSwitchingRef = useRef(false);

    // --------------------------------------------------------------------------
    // 1. Lógica de Processamento de Dados
    // --------------------------------------------------------------------------
    const handleMarketData = useCallback((response: any) => {
        if (isSwitchingRef.current) return;
        
        const responseSymbol = response.tick?.symbol || response.ohlc?.symbol || response.echo_req?.ticks_history || response.echo_req?.candles;
        if (responseSymbol && responseSymbol !== currentSymbolRef.current) {
            return;
        }

        if (response.error) {
            if (responseSymbol === currentSymbolRef.current && response.error.code !== 'AlreadySubscribed') {
                setChartError(response.error.message);
                setIsChartLoading(false);
            }
            return;
        }

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
                const isAreaChart = chartType === 'Area';
                
                // Base da requisição de histórico
                const historyRequest: any = {
                    ticks_history: activeSymbol,
                    count: 500,
                };
                
                // Base da requisição de subscrição
                const subscribeRequest: any = {
                    subscribe: 1,
                };

                if (isAreaChart) {
                    historyRequest.style = 'ticks';
                    historyRequest.end = 'latest';
                    subscribeRequest.ticks = activeSymbol;
                } else { // Candle chart
                    const granularity = getGranularityForTimePeriod(timePeriod);
                    historyRequest.style = 'candles';
                    historyRequest.granularity = granularity;
                    
                    subscribeRequest.ticks_history = activeSymbol;
                    subscribeRequest.style = 'candles';
                    subscribeRequest.granularity = granularity;
                }

                const historyResponse: any = await makeRequest(historyRequest);
                
                // Processa a resposta do histórico (seja 'history' ou 'candles')
                if (historyResponse.history) {
                    handleMarketData(historyResponse);
                } else if (historyResponse.candles) {
                    handleMarketData(historyResponse);
                }
                setIsChartLoading(false);

                // Subscreve para dados em tempo real
                await makeRequest(subscribeRequest);


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
            if (activeSubscriptionIdRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                makeRequest({ forget: activeSubscriptionIdRef.current }).catch(e => console.error("Cleanup falhou:", e));
                activeSubscriptionIdRef.current = null;
            }
        };
    }, [activeSymbol, isConnected, timePeriod, chartType, makeRequest, handleMarketData]);


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
