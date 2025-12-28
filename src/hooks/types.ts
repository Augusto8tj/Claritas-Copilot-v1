// This file can be used to share types between hooks

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
};

export type ChartData = TickData | CandleData;

export type DurationUnit = 't' | 's' | 'm' | 'h' | 'd';

export interface TradeAnnotation {
  id: string;
  contractId: string;
  entryTime: number; // epoch timestamp
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  direction: 'rise' | 'fall';
  status: 'pending' | 'won' | 'lost';
  stake: number;
  profit?: number;
  symbol: string;
}
