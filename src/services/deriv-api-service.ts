
'use client';

/**
 * @fileOverview This file contains only the type definitions for the Deriv API service.
 * All logic for creating WebSocket connections and making API calls has been centralized
 * in the use-deriv-api.tsx hook to prevent conflicting connections.
 */

export type AccountType = 'demo' | 'real';

export interface TradeResult {
  success: boolean;
  message: string;
  contractId?: number;
  entryTick?: number;
  entryTime?: number;
}

export interface Asset {
  value: string;
  label: string;
  marketIsOpen: boolean;
  submarket: string;
  market: string;
  minDuration: string;
}

export interface AssetGroup {
  label: string;
  options: Asset[];
}

export type HistoricalData = {
    date: string;
    price: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
};
