
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDerivApi } from './use-deriv-api';
import { calculateBollingerBands } from '@/services/indicator-service';

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

const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 0; 
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
    const { makeRequest, isConnected, addMarketDataListener, removeMarketDataListener } = useDerivApi();
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(true);
    const [chartError, setChartError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('Area');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('5m');
    const [showBollingerBands, setShowBollingerBands] = useState(true);
    
    const subscriptionIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (['1m', '2m', '3m'].includes(timePeriod) && chartType !== 'Area') {
            setChartType('Area');
        }
    }, [timePeriod, chartType]);

    const subscribeToSymbol = useCallback(async (symbol: string, newTimePeriod: TimePeriod) => {
        if (!isConnected) return;
        
        setIsChartLoading(true);
        setChartData([]);
        setChartError(null);

        try {
            if (subscriptionIdRef.current) {
                await makeRequest({ "forget": subscriptionIdRef.current });
                subscriptionIdRef.current = null;
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
    }, [isConnected, makeRequest]);

    useEffect(() => {
        const processAndSetCandleData = (candles: any[]) => {
            const candlesWithBands = calculateBollingerBands(candles);
            setChartData(candlesWithBands);
        };
        
        const marketDataCallback = (response: any) => {
                if (response.error) {
                    if (response.echo_req?.ticks_history || response.echo_req?.candles) {
                        setChartError(response.error.message);
                        setIsChartLoading(false);
                    }
                    return;
                }
                
                switch (response.msg_type) {
                    case 'tick':
                        const latestTick = { epoch: response.tick.epoch, price: response.tick.quote };
                        setChartData(prev => {
                            const data = [...(prev as TickData[])];
                            if(data.length > 0 && data[data.length-1].epoch === latestTick.epoch){
                                data[data.length -1] = latestTick;
                                return data;
                            }
                            return [...data.slice(-999), latestTick]
                        });
                        break;
                    case 'ohlc':
                         const latestOHLC = {
                            epoch: response.ohlc.epoch,
                            open: parseFloat(response.ohlc.open),
                            high: parseFloat(response.ohlc.high),
                            low: parseFloat(response.ohlc.low),
                            close: parseFloat(response.ohlc.close),
                        };
                         setChartData(prev => {
                            const data = [...(prev as CandleData[])];
                            const newData = data.length > 0 && data[data.length - 1].epoch === latestOHLC.epoch 
                                ? [...data.slice(0, -1), latestOHLC]
                                : [...data.slice(-999), latestOHLC];
                            
                            return calculateBollingerBands(newData);
                        });
                        break;
                    case 'history':
                        setChartData(response.history.prices.map((p: number, i: number) => ({ epoch: response.history.times[i], price: p })));
                        setIsChartLoading(false);
                        break;
                    case 'candles':
                        if (response.subscription?.id) {
                            subscriptionIdRef.current = response.subscription.id;
                        }
                        const rawData = response.candles || [];
                        const formattedData = rawData.map((c: any) => ({ ...c, open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low), close: parseFloat(c.close) }));
                        processAndSetCandleData(formattedData);
                        setIsChartLoading(false);
                        break;
                }
        };

        addMarketDataListener(marketDataCallback);
        return () => {
            removeMarketDataListener(marketDataCallback);
        };
    }, [addMarketDataListener, removeMarketDataListener]);


    useEffect(() => {
        if(activeSymbol && isConnected) {
            subscribeToSymbol(activeSymbol, timePeriod);
        }

        return () => {
            if (isConnected && subscriptionIdRef.current) {
                const forgetRequest = async () => {
                    try {
                        await makeRequest({ "forget": subscriptionIdRef.current });
                        subscriptionIdRef.current = null;
                    } catch(e) {
                         console.error("Error forgetting subscription on cleanup:", e)
                    }
                }
                forgetRequest();
            }
        }
    }, [activeSymbol, timePeriod, isConnected, subscribeToSymbol, makeRequest]);


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
