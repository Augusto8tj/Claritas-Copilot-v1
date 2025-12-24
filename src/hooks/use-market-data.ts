'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDerivApi } from './use-deriv-api';
import { calculateBollingerBands } from '@/services/indicator-service';

/* =========================================================
   TYPES
========================================================= */
export type TimePeriod = '1m' | '2m' | '3m' | '5m' | '10m' | '15m' | '30m' | '1h' | '8h' | '1d';
export type ChartType = 'Area' | 'Candle';

export type TickData = {
  epoch: number;
  price: number;
};

export type CandleData = {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
};

export type ChartData = TickData | CandleData;

/* =========================================================
   HELPERS
========================================================= */
const MAX_DATA_POINTS = 1000;

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 0; // Ticks
        case '2m': return 120;
        case '3m': return 180;
        case '5m': return 300;
        case '10m': return 600;
        case '15m': return 900;
        case '30m': return 1800;
        case '1h': return 3600;
        case '8h': return 28800;
        case '1d': return 86400;
        default: return 0;
    }
};

const validateNumber = (val: any, fallback = 0): number => {
    const num = Number(val);
    return isFinite(num) ? num : fallback;
};

const addDataPoint = <T extends ChartData>(prevData: T[], newPoint: T): T[] => {
    const data = [...prevData];
    if (data.length >= MAX_DATA_POINTS) {
        data.shift(); // Remove o mais antigo
    }
    data.push(newPoint);
    return data;
};


/* =========================================================
   HOOK PRINCIPAL
========================================================= */
export function useMarketData(activeSymbol: string | null, dataCount: number = 100) {
    const { makeRequest, isConnected, addMarketDataListener, removeMarketDataListener } = useDerivApi();
    
    // Estados visuais
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(!!activeSymbol);
    const [chartError, setChartError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('Candle');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('5m');
    const [showBollingerBands, setShowBollingerBands] = useState(true);

    // Refs de Controle (Critical para evitar Race Conditions)
    const activeSubscriptionIdRef = useRef<string | null>(null);
    const currentSymbolRef = useRef<string | null>(null);
    const isSwitchingRef = useRef(false);

    // Ajuste automático do tipo de gráfico baseado no timePeriod
    useEffect(() => {
        const isLowTimeFrame = ['1m'].includes(timePeriod);
        if (isLowTimeFrame) {
            setChartType('Area');
        } else {
            setChartType('Candle');
        }
    }, [timePeriod]);

    // --------------------------------------------------------------------------
    // 1. Lógica de Processamento de Dados (Ouvinte)
    // --------------------------------------------------------------------------
    const handleMarketData = useCallback((response: any) => {
        if (isSwitchingRef.current) return;
        
        const responseSymbol = response.echo_req?.ticks_history || response.echo_req?.candles || response.tick?.symbol || response.ohlc?.symbol;
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

        const msgType = response.msg_type;

        if (msgType === 'history') {
            const { prices, times } = response.history;
            const formatted: TickData[] = prices.map((p: number, i: number) => ({
                epoch: times[i],
                price: validateNumber(p)
            })).filter((d: TickData) => d.price > 0);
            
            setChartData(formatted);
            setIsChartLoading(false);
        }
        else if (msgType === 'candles') {
            if (response.subscription?.id) {
                activeSubscriptionIdRef.current = response.subscription.id;
            }
            
            const rawCandles = response.candles || [];
            const formatted: CandleData[] = rawCandles.map((c: any) => ({
                epoch: c.epoch,
                open: validateNumber(c.open),
                high: validateNumber(c.high),
                low: validateNumber(c.low),
                close: validateNumber(c.close)
            })).filter((c: CandleData) => c.close > 0);

            const withBands = calculateBollingerBands(formatted);
            setChartData(withBands);
            setIsChartLoading(false);
        }
        else if (msgType === 'tick') {
            if (activeSubscriptionIdRef.current && response.subscription?.id !== activeSubscriptionIdRef.current) return;

            const tick = response.tick;
            const newTick: TickData = { epoch: tick.epoch, price: validateNumber(tick.quote) };
            if (newTick.price === 0) return;

            setChartData(prev => {
                if (prev.length === 0) return [newTick];
                const last = prev[prev.length - 1] as TickData;
                if (last.epoch === newTick.epoch) {
                    const newData = [...prev];
                    newData[newData.length - 1] = newTick;
                    return newData;
                }
                return addDataPoint(prev, newTick);
            });
        }
        else if (msgType === 'ohlc') {
            if (activeSubscriptionIdRef.current && response.subscription?.id !== activeSubscriptionIdRef.current) return;

            const ohlc = response.ohlc;
            const newCandle: CandleData = {
                epoch: ohlc.epoch,
                open: validateNumber(ohlc.open),
                high: validateNumber(ohlc.high),
                low: validateNumber(ohlc.low),
                close: validateNumber(ohlc.close),
            };
            if (newCandle.close === 0) return;

            setChartData(prev => {
                if (prev.length === 0) return calculateBollingerBands([newCandle]);

                const data = [...(prev as CandleData[])];
                const last = data[data.length - 1];

                if (last.epoch === newCandle.epoch) {
                    data[data.length - 1] = newCandle;
                } else {
                    data.push(newCandle);
                    if (data.length > MAX_DATA_POINTS) data.shift();
                }
                
                return calculateBollingerBands(data);
            });
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
    // 3. Função Centralizada de Subscrição (Atomic Switch)
    // --------------------------------------------------------------------------
    useEffect(() => {
        const subscribeToSymbol = async () => {
            if (!isConnected || !activeSymbol) {
                if (!activeSymbol) setIsChartLoading(false);
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
                    console.error(`Falha ao cancelar subscrição ${activeSubscriptionIdRef.current}:`, e);
                }
                activeSubscriptionIdRef.current = null;
            }
            
            isSwitchingRef.current = false; // Pode destravar agora

            try {
                const granularity = getGranularityForTimePeriod(timePeriod);
                const isCandleRequest = granularity > 0;
                
                const request: any = {
                    ticks_history: activeSymbol,
                    adjust_start_time: 1,
                    count: dataCount,
                    end: 'latest',
                    style: isCandleRequest ? 'candles' : 'ticks',
                    subscribe: 1,
                };

                if (isCandleRequest) {
                    request.granularity = granularity;
                }
                
                // A resposta e o ID da subscrição serão tratados pelo `handleMarketData`
                await makeRequest(request);

            } catch (error: any) {
                if(currentSymbolRef.current === activeSymbol) { // Só define erro se ainda for o ativo atual
                    setChartError(error.message || "Erro ao subscrever dados de mercado.");
                    setIsChartLoading(false);
                }
            }
        };

        subscribeToSymbol();
        
        // Cleanup na desmontagem do componente
        return () => {
            if (activeSubscriptionIdRef.current) {
                makeRequest({ forget: activeSubscriptionIdRef.current }).catch(e => console.error("Cleanup falhou ao cancelar subscrição:", e));
            }
        };
    // A DEPENDÊNCIA DE `chartType` FOI REMOVIDA PARA EVITAR RE-SUBSCRIÇÃO
    }, [activeSymbol, timePeriod, isConnected, makeRequest, dataCount]);


    return {
        chartData,
        isChartLoading,
        chartError,
        chartType,
        setChartType,
        timePeriod,
        setTimePeriod,
        showBollingerBands,
        setShowBollingerBands,
    };
}
