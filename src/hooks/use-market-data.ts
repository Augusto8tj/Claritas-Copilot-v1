
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';

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
ax: number;
  close: number;
  volume?: number;
  bollingerBands?: [number, number];
};

export type ChartData = TickData | CandleData;

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 0; // Tick data is requested with granularity 0
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
}

export function useMarketData(activeSymbol: string | null) {
    const { ws, makeRequest, isConnected } = useDerivApi();
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(true);
    const [chartError, setChartError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('Area');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('5m');
    const [showBollingerBands, setShowBollingerBands] = useState(true);
    
    const subscriptionIdRef = useRef<string | null>(null);

    const messageQueueRef = useRef<any[]>([]);
    const isProcessingQueueRef = useRef(false);
    const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const THROTTLE_INTERVAL = 250;

    useEffect(() => {
        if (!ws || !isConnected) return;

        const processMessageQueue = () => {
            if (messageQueueRef.current.length === 0) {
                isProcessingQueueRef.current = false;
                return;
            }

            const responsesToProcess = [...messageQueueRef.current];
            messageQueueRef.current = [];

            let latestTick: TickData | null = null;
            let latestOHLC: CandleData | null = null;
            
            responsesToProcess.forEach(response => {
                if (response.error) {
                    console.error("[Market Data Hook] Error received:", response.error.message);
                     if (response.echo_req?.ticks_history || response.echo_req?.candles) {
                        setChartError(response.error.message);
                        setIsChartLoading(false);
                    }
                    return;
                }
                
                switch (response.msg_type) {
                    case 'tick':
                        latestTick = { epoch: response.tick.epoch, price: response.tick.quote };
                        break;
                    case 'ohlc':
                        latestOHLC = {
                            epoch: response.ohlc.epoch,
                            open: parseFloat(response.ohlc.open),
                            high: parseFloat(response.ohlc.high),
                            low: parseFloat(response.ohlc.low),
                            close: parseFloat(response.ohlc.close),
                        };
                        break;
                    case 'history':
                    case 'candles':
                        if (response.subscription?.id) {
                            subscriptionIdRef.current = response.subscription.id;
                        }
                        const rawData = response.candles || (response.history ? response.history.prices.map((p: number, i: number) => ({
                            epoch: response.history.times[i], close: p, open: p, high: p, low: p,
                        })) : []);
                        const formattedData = rawData.map((c: any) => ({ ...c, open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low), close: parseFloat(c.close) }));
                        setChartData(formattedData);
                        setIsChartLoading(false);
                        break;
                    case 'forget':
                        subscriptionIdRef.current = null;
                        break;
                }
            });
            
            if (latestTick) {
                setChartData(prev => [...(prev as TickData[]).slice(-999), latestTick!]);
            }

            if (latestOHLC) {
                setChartData(prev => {
                    const data = [...(prev as CandleData[])];
                    if (data.length > 0 && data[data.length - 1].epoch === latestOHLC!.epoch) {
                        data[data.length - 1] = latestOHLC!;
                        return data;
                    } else {
                        return [...data.slice(-999), latestOHLC!];
                    }
                });
            }
            
            isProcessingQueueRef.current = false;
            if (messageQueueRef.current.length > 0) {
               throttleTimeoutRef.current = setTimeout(processMessageQueue, THROTTLE_INTERVAL);
            }
        };

        const messageHandler = (event: MessageEvent) => {
            try {
                const response = JSON.parse(event.data);
                if (response.req_id) {
                    // Ignore messages with req_id as they are handled by promises in useDerivApi
                    return;
                }
                messageQueueRef.current.push(response);
                if (!isProcessingQueueRef.current) {
                    isProcessingQueueRef.current = true;
                    processMessageQueue();
                }
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        ws.addEventListener('message', messageHandler);
        return () => {
            ws.removeEventListener('message', messageHandler);
            if (throttleTimeoutRef.current) {
                clearTimeout(throttleTimeoutRef.current);
            }
        };
    }, [ws, isConnected]);


    const subscribeToSymbol = useCallback(async (symbol: string, newTimePeriod: TimePeriod) => {
        if (!ws || !isConnected) return;
        
        setIsChartLoading(true);
        setChartData([]);
        setChartError(null);

        try {
            if (subscriptionIdRef.current) {
                await makeRequest({ "forget": subscriptionIdRef.current });
            }

            const granularity = getGranularityForTimePeriod(newTimePeriod);
            const style = granularity === 0 ? 'ticks' : 'candles';

            const request: any = {
                ticks_history: symbol,
                style: style,
                end: 'latest',
                count: 1000, 
                subscribe: 1,
            };

            if (style === 'candles') {
                request.granularity = granularity;
                request.adjust_start_time = 1;
            }
            
            await makeRequest(request);

        } catch (e: any) {
            setChartError(e.message);
            setIsChartLoading(false);
        }
    }, [ws, isConnected, makeRequest]);

    // This effect now handles subscribing and unsubscribing
    useEffect(() => {
        if(activeSymbol && isConnected) {
            subscribeToSymbol(activeSymbol, timePeriod);
        }

        // Cleanup function to forget subscription when component unmounts or symbol changes
        return () => {
            if (ws && isConnected && subscriptionIdRef.current) {
                makeRequest({ "forget": subscriptionIdRef.current }).catch(e => console.error("Error forgetting subscription:", e));
            }
        }
    }, [activeSymbol, timePeriod, isConnected, subscribeToSymbol, ws, makeRequest]);


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
