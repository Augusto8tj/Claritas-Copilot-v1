
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDerivApi } from './use-deriv-api';

/* =========================================================
   TYPES (SIMPLIFICADAS PARA DEBUG)
========================================================= */
export type TimePeriod = '1m' | '2m' | '3m' | '5m' | '10m' | '15m' | '30m' | '1h' | '8h' | '1d';
export type ChartType = 'Area' | 'Candle';

export type TickData = {
  epoch: number;
  price: number;
};

// Por agora, o ChartData será apenas TickData
export type ChartData = TickData;

/* =========================================================
   HELPERS
========================================================= */
const MAX_DATA_POINTS = 1000;

const validateNumber = (val: any, fallback = 0): number => {
    const num = Number(val);
    return isFinite(num) ? num : fallback;
};

const addDataPoint = (prevData: TickData[], newPoint: TickData): TickData[] => {
    const data = [...prevData];
    if (data.length >= MAX_DATA_POINTS) {
        data.shift();
    }
    data.push(newPoint);
    return data;
};


/* =========================================================
   HOOK PRINCIPAL (SIMPLIFICADO PARA DEBUG)
========================================================= */
export function useMarketData(activeSymbol: string | null) {
    const { makeRequest, isConnected, addMarketDataListener, removeMarketDataListener } = useDerivApi();
    
    // Estados visuais
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(true);
    const [chartError, setChartError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('Area');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('1m'); // Fixo para ticks

    // Refs de Controle
    const activeSubscriptionIdRef = useRef<string | null>(null);
    const currentSymbolRef = useRef<string | null>(null);
    const isSwitchingRef = useRef(false);

    // --------------------------------------------------------------------------
    // 1. Lógica de Processamento de Dados (Ouvinte Simplificado)
    // --------------------------------------------------------------------------
    const handleMarketData = useCallback((response: any) => {
        if (isSwitchingRef.current) return;
        
        const responseSymbol = response.tick?.symbol || response.echo_req?.ticks_history;
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

        if (response.msg_type === 'history') {
            const { prices, times } = response.history;
            const formatted: TickData[] = prices.map((p: number, i: number) => ({
                epoch: times[i],
                price: validateNumber(p)
            })).filter((d: TickData) => d.price > 0);
            
            setChartData(formatted);
            setIsChartLoading(false);
        }
        else if (response.msg_type === 'tick') {
            if (response.subscription?.id) {
                 activeSubscriptionIdRef.current = response.subscription.id;
            }

            const tick = response.tick;
            const newTick: TickData = { epoch: tick.epoch, price: validateNumber(tick.quote) };
            if (newTick.price === 0) return;

            setChartData(prev => {
                const data = prev as TickData[];
                if (data.length === 0) return [newTick];
                const last = data[data.length - 1];
                if (last && last.epoch === newTick.epoch) {
                    const newData = [...data];
                    newData[newData.length - 1] = newTick;
                    return newData;
                }
                return addDataPoint(data, newTick);
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
    // 3. Função Centralizada de Subscrição (Simplificada)
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
            
            isSwitchingRef.current = false;

            try {
                // Pedido simplificado para apenas ticks
                const request = {
                    ticks_history: activeSymbol,
                    adjust_start_time: 1,
                    count: 1000, 
                    end: 'latest',
                    style: 'ticks',
                    subscribe: 1,
                };
                
                await makeRequest(request);

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
            }
        };
    }, [activeSymbol, isConnected, makeRequest]);


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
