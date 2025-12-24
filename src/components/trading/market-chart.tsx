'use client';

import * as React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine, Label, BarChart, Bar, ComposedChart, ReferenceDot, Area } from "recharts";
import { Loader2 } from "lucide-react";
import type { CandleData, TickData, ChartData, ActiveContract } from '@/hooks/use-market-data';
import type { TimePeriod, ChartType } from '@/hooks/use-market-data';

const Candlestick = (props: any) => {
    const { x, y, width, height, payload, yAxis } = props;
    
    if (!payload || !yAxis || !yAxis.scale) {
        return null;
    }
    
    const { open, close, high, low } = payload;
    if ([open, close, high, low].some(val => val === undefined || isNaN(val))) {
        return null;
    }

    const isBullish = close > open;
    const color = isBullish ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))';

    const scale = yAxis.scale;
    const yHigh = scale(high);
    const yLow = scale(low);
    const yOpen = scale(open);
    const yClose = scale(close);

    const bodyHeight = Math.max(1, Math.abs(yOpen - yClose));
    const bodyY = Math.min(yOpen, yClose);

    return (
        <g stroke={color} fill={color} strokeWidth="1">
            {/* Wick */}
            <line x1={x + width / 2} y1={yHigh} x2={x + width / 2} y2={yLow} />
            
            {/* Body */}
            <rect x={x} y={bodyY} width={width} height={bodyHeight} />
        </g>
    );
};

// Componente customizado para renderizar pontos de contrato com label
const ContractDot = (props: any) => {
    const { cx, cy, payload, dataKey, fill, stroke, strokeWidth, label, r } = props;
    
    if (!cx || !cy || isNaN(cx) || isNaN(cy)) {
        return null;
    }

    return (
        <g>
            <circle cx={cx} cy={cy} r={r || 6} fill={fill} stroke={stroke} strokeWidth={strokeWidth || 2} />
            {label && (
                <text 
                    x={cx} 
                    y={cy - 15} 
                    textAnchor="middle" 
                    fill={fill}
                    fontSize={11}
                    fontWeight="bold"
                >
                    {label}
                </text>
            )}
        </g>
    );
};

interface MarketChartProps {
  activeContracts: ActiveContract[];
  zoomLevel: number;
  chartData: ChartData[];
  isChartLoading: boolean;
  chartError: string | null;
  chartType: ChartType;
  timePeriod: TimePeriod;
  showBollingerBands: boolean;
}

export function MarketChart({ 
    activeContracts, 
    zoomLevel,
    chartData,
    isChartLoading,
    chartError,
    chartType,
    timePeriod,
    showBollingerBands,
}: MarketChartProps) {
  
  const visibleData = React.useMemo(() => {
    if (chartData.length > zoomLevel) {
        return chartData.slice(chartData.length - zoomLevel);
    }
    return chartData;
  }, [chartData, zoomLevel]);

  // Debug dos contratos ativos
  React.useEffect(() => {
    if (activeContracts.length > 0) {
      console.log('📊 Contratos ativos no gráfico:', activeContracts);
      console.log('📈 Dados do gráfico (primeiros 3):', visibleData.slice(0, 3));
      console.log('📈 Dados do gráfico (últimos 3):', visibleData.slice(-3));
    }
  }, [activeContracts, visibleData]);

  // Função para renderizar os contratos no gráfico
  const renderContractMarkers = (contracts: ActiveContract[]) => {
    return contracts.map(contract => {
      console.log('🎯 Renderizando contrato:', {
        id: contract.contractId,
        entryTime: contract.entryTime,
        entryTick: contract.entryTick,
        exitTime: contract.exitTime,
        exitTick: contract.exitTick,
        status: contract.status
      });

      return (
        <React.Fragment key={contract.contractId}>
          {/* Ponto de Entrada */}
          <ReferenceDot
            x={contract.entryTime}
            y={contract.entryTick}
            r={6}
            fill="hsl(var(--accent))"
            stroke="white"
            strokeWidth={2}
            label={{ 
              value: 'ENTRADA', 
              position: 'top',
              fill: 'hsl(var(--accent))',
              fontSize: 11,
              fontWeight: 'bold'
            }}
          />
          
          {/* Linha de Entrada */}
          <ReferenceLine 
            y={contract.entryTick} 
            stroke="hsl(var(--accent))" 
            strokeDasharray="3 3"
            strokeWidth={1}
            opacity={0.5}
          />

          {/* Ponto de Saída (se o contrato fechou) */}
          {contract.status !== 'open' && contract.exitTime && contract.exitTick && (
            <>
              <ReferenceDot
                x={contract.exitTime}
                y={contract.exitTick}
                r={6}
                fill={contract.status === 'won' ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}
                stroke="white"
                strokeWidth={2}
                label={{ 
                  value: contract.status === 'won' ? '✓ LUCRO' : '✗ PERDA',
                  position: 'top',
                  fill: contract.status === 'won' ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))',
                  fontSize: 11,
                  fontWeight: 'bold'
                }}
              />
              
              {/* Linha de Saída */}
              <ReferenceLine 
                y={contract.exitTick} 
                stroke={contract.status === 'won' ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'} 
                strokeDasharray="3 3"
                strokeWidth={1}
                opacity={0.5}
              />
            </>
          )}
        </React.Fragment>
      );
    });
  };
  
  const renderChart = () => {
    // Verifica se há dados
    if (!visibleData || visibleData.length === 0) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <p className="text-muted-foreground">Aguardando dados do mercado...</p>
        </div>
      );
    }

    // Para períodos de tick (1m, 2m, 3m), usa gráfico de linha
    if (['1m','2m','3m'].includes(timePeriod)) {
      const tickData = visibleData as TickData[];
      
      // Valida os dados
      const validTickData = tickData.filter(d => d.epoch && d.price && !isNaN(d.price));
      
      if (validTickData.length === 0) {
        return (
          <div className="h-full w-full flex items-center justify-center">
            <p className="text-muted-foreground">Dados de tick inválidos</p>
          </div>
        );
      }

      const xDomain: [number, number] = [
        validTickData[0].epoch, 
        validTickData[validTickData.length - 1].epoch
      ];
      
      // Calcula domínio Y com margem
      const prices = validTickData.map(d => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;
      const margin = priceRange * 0.1; // 10% de margem
      
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={validTickData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="epoch"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(epoch: number) => {
                const date = new Date(epoch * 1000);
                return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              }}
              type="number"
              domain={xDomain}
              scale="time"
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[minPrice - margin, maxPrice + margin]}
              tickFormatter={(value) => Number(value).toFixed(4)}
              orientation="right"
              width={80}
            />
            <Tooltip
              formatter={(value: number) => [Number(value).toFixed(4), "Preço"]}
              labelFormatter={(epoch: number) => {
                const date = new Date(epoch * 1000);
                return date.toLocaleString('pt-BR');
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                borderColor: 'hsl(var(--border))', 
                borderRadius: 'var(--radius)' 
              }}
              animationDuration={0}
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
            {renderContractMarkers(activeContracts)}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Para outros períodos, usa dados de candle
    const candleData = visibleData as CandleData[];
    
    // Valida os dados de candle
    const validCandleData = candleData.filter(d => 
      d.epoch && 
      d.open && d.high && d.low && d.close &&
      !isNaN(d.open) && !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close)
    );

    if (validCandleData.length === 0) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <p className="text-muted-foreground">Dados de candle inválidos</p>
        </div>
      );
    }

    // Calcula domínio Y
    const allLows = validCandleData.map(d => d.low);
    const allHighs = validCandleData.map(d => d.high);
    const minPrice = Math.min(...allLows);
    const maxPrice = Math.max(...allHighs);
    const priceRange = maxPrice - minPrice;
    const margin = priceRange * 0.1;
    const yDomain: [number, number] = [minPrice - margin, maxPrice + margin];

    // Gráfico de Candles
    if (chartType === 'Candle') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={validCandleData} barGap={0} barCategoryGap="5%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="epoch" 
              tickFormatter={(epoch: number) => {
                const date = new Date(epoch * 1000);
                return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              }}
              type="number"
              domain={['dataMin', 'dataMax']}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              scale="time"
            />
            <YAxis 
              domain={yDomain}
              tickFormatter={(val) => Number(val).toFixed(4)}
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              width={80}
            />
            <Tooltip
              labelFormatter={(label) => {
                const date = new Date(label * 1000);
                return date.toLocaleString('pt-BR');
              }}
              formatter={(value, name, props) => {
                if (name === 'bollingerBands') return null;
                if (props.payload) {
                  const { open, high, low, close } = props.payload;
                  return [
                    <div key="candle-info" style={{ fontSize: '12px' }}>
                      <div>Abertura: {open?.toFixed(4)}</div>
                      <div>Máxima: {high?.toFixed(4)}</div>
                      <div>Mínima: {low?.toFixed(4)}</div>
                      <div>Fechamento: {close?.toFixed(4)}</div>
                    </div>
                  ];
                }
                return [value];
              }}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                borderColor: 'hsl(var(--border))', 
                borderRadius: 'var(--radius)' 
              }}
            />
            {showBollingerBands && (
              <Area 
                dataKey="bollingerBands" 
                stroke="hsl(var(--primary) / 0.5)"
                fill="hsl(var(--primary) / 0.1)"
                isAnimationActive={false} 
                type="monotone"
              />
            )}
            <Bar dataKey="close" shape={<Candlestick />} isAnimationActive={false} />
            {renderContractMarkers(activeContracts)}
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // Gráfico de Linha (fallback)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={validCandleData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="epoch"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(epoch: number) => {
              const date = new Date(epoch * 1000);
              return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }}
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            tickFormatter={(value) => Number(value).toFixed(4)}
            orientation="right"
            width={80}
          />
          <Tooltip
            formatter={(value: number) => [Number(value).toFixed(4), "Preço de Fechamento"]}
            labelFormatter={(epoch: number) => {
              const date = new Date(epoch * 1000);
              return date.toLocaleString('pt-BR');
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              borderColor: 'hsl(var(--border))', 
              borderRadius: 'var(--radius)' 
            }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="close"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
          {renderContractMarkers(activeContracts)}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  if (isChartLoading && visibleData.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-3">Carregando dados do gráfico...</p>
      </div>
    );
  }

  if (chartError) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center text-center p-4">
        <p className="text-destructive">{chartError}</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full relative group">
      {renderChart()}
    </div>
  );
}
