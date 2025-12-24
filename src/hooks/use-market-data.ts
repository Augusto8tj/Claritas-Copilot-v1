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
const getGranularityForTimePeriod = (timePeriod: TimePeriod): number => {
    switch(timePeriod) {
        case '1m': return 0; // 0 = ticks (para a API, mas vamos tratar ticks vs candles na lógica)
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

/* =========================================================
   HOOK PRINCIPAL
========================================================= */
export function useMarketData(activeSymbol: string | null) {
    const { makeRequest, isConnected, addMarketDataListener, removeMarketDataListener } = useDerivApi();
    
    // Estados visuais
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(false); // Começa false, ativa ao trocar
    const [chartError, setChartError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<ChartType>('Area');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('5m');
    const [showBollingerBands, setShowBollingerBands] = useState(true);

    // Refs de Controle (Critical para evitar Race Conditions)
    const activeSubscriptionIdRef = useRef<string | null>(null);
    const currentSymbolRef = useRef<string | null>(null);
    const isSwitchingRef = useRef(false);

    // Ajuste automático do tipo de gráfico baseado no timePeriod
    useEffect(() => {
        const isLowTimeFrame = ['1m', '2m', '3m'].includes(timePeriod);
        if (isLowTimeFrame && chartType !== 'Area') {
            setChartType('Area');
        }
    }, [timePeriod, chartType]);

    // --------------------------------------------------------------------------
    // 1. Lógica de Processamento de Dados (Ouvinte)
    // --------------------------------------------------------------------------
    const handleMarketData = useCallback((response: any) => {
        // Se estamos no meio de uma troca de ativo, ignoramos qualquer dado chegando
        if (isSwitchingRef.current) return;

        // Se houver erro na resposta
        if (response.error) {
            // Verifica se o erro pertence à requisição atual
            const reqSymbol = response.echo_req?.ticks_history || response.echo_req?.candles;
            if (reqSymbol === currentSymbolRef.current) {
                setChartError(response.error.message);
                setIsChartLoading(false);
            }
            return;
        }

        const msgType = response.msg_type;

        // A. Histórico de Ticks (Snapshot inicial para Area Chart)
        if (msgType === 'history') {
            const history = response.history;
            const prices = history.prices;
            const times = history.times;
            const formatted: TickData[] = prices.map((p: number, i: number) => ({
                epoch: times[i],
                price: p
            }));
            
            setChartData(formatted);
            setIsChartLoading(false);
        }

        // B. Histórico de Candles (Snapshot inicial para Candle Chart)
        else if (msgType === 'candles') {
            // Salva o ID da subscrição se houver
            if (response.subscription?.id) {
                activeSubscriptionIdRef.current = response.subscription.id;
            }
            
            const rawCandles = response.candles || [];
            const formatted = rawCandles.map((c: any) => ({
                epoch: c.epoch,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close)
            }));

            const withBands = calculateBollingerBands(formatted);
            setChartData(withBands);
            setIsChartLoading(false);
        }

        // C. Update em Tempo Real (Tick)
        else if (msgType === 'tick') {
            // Só aceita o tick se pertencer à subscrição ativa ou ao símbolo ativo
            // (Ticks stream nem sempre mandam echo_req claro, então confiamos no ID se existir, ou no timing)
            if (activeSubscriptionIdRef.current && response.subscription?.id !== activeSubscriptionIdRef.current) {
                return;
            }

            const tick = response.tick;
            const newTick: TickData = { epoch: tick.epoch, price: tick.quote };

            setChartData(prev => {
                // Evita updates em array vazio se o histórico ainda não carregou
                if (prev.length === 0) return [newTick];
                
                const last = prev[prev.length - 1] as TickData;
                // Se for update do mesmo segundo, atualiza o último
                if (last.epoch === newTick.epoch) {
                    const newData = [...prev];
                    newData[newData.length - 1] = newTick;
                    return newData;
                }
                // Senão adiciona novo e mantém tamanho controlado
                return [...prev.slice(-1000), newTick];
            });
        }

        // D. Update em Tempo Real (OHLC / Candle)
        else if (msgType === 'ohlc') {
            if (activeSubscriptionIdRef.current && response.subscription?.id !== activeSubscriptionIdRef.current) {
                return;
            }

            const ohlc = response.ohlc;
            const newCandle: CandleData = {
                epoch: ohlc.epoch,
                open: Number(ohlc.open),
                high: Number(ohlc.high),
                low: Number(ohlc.low),
                close: Number(ohlc.close_quote || ohlc.close), // API Deriv às vezes usa close_quote em streams
            };

            setChartData(prev => {
                if (prev.length === 0) return calculateBollingerBands([newCandle]);

                const data = [...(prev as CandleData[])];
                const last = data[data.length - 1];

                // Se estamos na mesma vela (mesmo epoch ou dentro da granularidade), atualiza a última
                if (last.epoch === newCandle.epoch) {
                    data[data.length - 1] = newCandle;
                } else {
                    // Nova vela fechou, adiciona nova
                    if (data.length > 1000) data.shift();
                    data.push(newCandle);
                }
                
                // Recalcula bandas (idealmente só para as últimas, mas aqui recalculamos tudo para segurança)
                return calculateBollingerBands(data);
            });
        }

    }, []);

    // --------------------------------------------------------------------------
    // 2. Lifecycle do Listener
    // --------------------------------------------------------------------------
    useEffect(() => {
        addMarketDataListener(handleMarketData);
        return () => removeMarketDataListener(handleMarketData);
    }, [addMarketDataListener, removeMarketDataListener, handleMarketData]);


    // --------------------------------------------------------------------------
    // 3. Função Centralizada de Subscrição (Atomic Switch)
    // --------------------------------------------------------------------------
    useEffect(() => {
        const subscribeToSymbol = async () => {
            if (!isConnected || !activeSymbol) return;

            // --- FASE 1: LIMPEZA IMEDIATA (Atomic) ---
            isSwitchingRef.current = true; // Trava o listener de receber lixo antigo
            currentSymbolRef.current = activeSymbol;
            
            // Limpa dados VISUAIS instantaneamente
            setChartData([]); 
            setIsChartLoading(true);
            setChartError(null);

            // --- FASE 2: CANCELAMENTO DO ANTERIOR ---
            if (activeSubscriptionIdRef.current) {
                try {
                    await makeRequest({ forget: activeSubscriptionIdRef.current });
                } catch (e) {
                    console.warn("Erro ao esquecer subscrição antiga", e);
                }
                activeSubscriptionIdRef.current = null;
            }

            // --- FASE 3: NOVA REQUISIÇÃO ---
            try {
                const granularity = getGranularityForTimePeriod(timePeriod);
                const isCandleRequest = granularity > 0;
                
                const request: any = {
                    ticks_history: activeSymbol,
                    adjust_start_time: 1,
                    count: 1000,
                    end: 'latest',
                    style: isCandleRequest ? 'candles' : 'ticks',
                    subscribe: 1, // Assinar updates
                };

                if (isCandleRequest) {
                    request.granularity = granularity;
                }

                // Destrava o listener logo antes de enviar o request, 
                // pois o próximo msg que vier já será resposta disso (ou erro)
                isSwitchingRef.current = false;

                const response = await makeRequest(request);

                if (response.error) {
                    setChartError(response.error.message);
                    setIsChartLoading(false);
                    return;
                }

                // Se for tick stream, o ID vem no response inicial do ticks_history às vezes não vem direto
                // Mas geralmente vem num msg_type: 'history' ou 'candles' subsequente.
                // Se vier direto no response inicial (algumas versões da API):
                if (response.subscription) {
                    activeSubscriptionIdRef.current = response.subscription.id;
                }

            } catch (error: any) {
                setChartError(error.message || "Erro desconhecido");
                setIsChartLoading(false);
                isSwitchingRef.current = false;
            }
        };

        subscribeToSymbol();

        // Cleanup ao desmontar ou trocar dependências
        return () => {
            // Opcional: Se quiser garantir que ao sair do componente pare tudo
            // Mas o próprio subscribeToSymbol já lida com o "forget" do anterior ao rodar novamente
        };

    }, [activeSymbol, timePeriod, isConnected, makeRequest]); // Dependências controladas


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