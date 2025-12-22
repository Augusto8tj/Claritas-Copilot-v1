

'use client';

import type { AccountType } from '@/hooks/use-deriv-api';
import type { MutableRefObject } from 'react';
import type { DurationUnit } from '@/components/trading/deriv-trader-interface.types';


/**
 * @fileOverview Service for interacting with the Deriv brokerage API.
 */

const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089";

// This is a generic function now, for simple, single-request API calls.
function callDerivApi<T>(request: object, apiToken: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    
    ws.onopen = () => {
        ws.send(JSON.stringify({ "authorize": apiToken }));
    };

    ws.onmessage = (data: MessageEvent) => {
      const response = JSON.parse(data.data);
      if (response.error) {
        reject(new Error(response.error.message));
        ws.close();
        return;
      }

      if (response.msg_type === 'authorize') {
          if(response.authorize) {
            ws.send(JSON.stringify(request));
          } else {
             reject(new Error("Authorization failed."));
             ws.close();
          }
      } else {
        resolve(response as T);
        ws.close();
      }
    };

    ws.onerror = (error) => {
      reject(error);
      ws.close();
    };
  });
}

interface AccountBalance {
  balance: number;
  currency: string;
}

interface MarketData {
  symbol: string;
  price: number;
  changePercent: number;
}

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
}

export interface AssetGroup {
  label: string;
  options: Asset[];
}


/**
 * Fetches the list of all available assets from the Deriv API.
 */
export async function getAvailableAssets(): Promise<AssetGroup[]> {
  console.log("[Deriv Service] Fetching available assets...");
  try {
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    const response: any = await new Promise((resolve, reject) => {
        ws.onopen = () => {
            // Use ping to ensure connection is ready
            ws.send(JSON.stringify({ "ping": 1 }));
        };
        ws.onmessage = (data) => {
            const res = JSON.parse(data.data);
            if (res.error) {
              reject(new Error(res.error.message || 'Unknown API error'));
              ws.close();
              return;
            }
            
            // If we get a pong, the connection is alive, now we can request assets
            if (res.msg_type === 'pong') {
                 ws.send(JSON.stringify({ "active_symbols": "full", "product_type": "basic" }));
            }
            
            // This is the actual response for our request
            if (res.msg_type === 'active_symbols') {
              resolve(res);
              ws.close();
            }
        };
        ws.onerror = (err) => {
            // WebSocket errors don't have a specific message, so we create one.
            reject(new Error('WebSocket connection error'));
            ws.close();
        };
    });

    if (!response.active_symbols) {
      throw new Error("Invalid response from active_symbols");
    }

    const groupedAssets: { [key: string]: Asset[] } = {};

    for (const symbol of response.active_symbols) {
        if (symbol.market === 'synthetic_index') { // Only include Volatility Indices
            const market = symbol.market_display_name;
            if (!groupedAssets[market]) {
                groupedAssets[market] = [];
            }
            groupedAssets[market].push({
                value: symbol.symbol,
                label: symbol.display_name
            });
        }
    }

    const assetGroups: AssetGroup[] = Object.keys(groupedAssets).map(label => ({
      label,
      options: groupedAssets[label].sort((a,b) => a.label.localeCompare(b.label))
    })).sort((a, b) => a.label.localeCompare(b.label));
    
    console.log(`[Deriv Service] Found ${assetGroups.length} asset groups.`);
    return assetGroups;

  } catch (error) {
    console.error("[Deriv Service] Error fetching available assets:", error);
    // Return a fallback list so the UI doesn't break
    return [
      {
        label: "Índices de Volatilidade",
        options: [{ value: "1HZ100V", label: "Volatility 100 (1s) Index" }],
      },
      {
        label: "Erro",
        options: [{ value: "error", label: "Não foi possível carregar outros ativos" }],
      },
    ];
  }
}


/**
 * Fetches the user's account balance from the broker.
 * @param apiToken - The user's API token for authentication.
 */
export async function getAccountBalance(apiToken: string, accountType: AccountType): Promise<AccountBalance> {
  console.log(`[Deriv Service] Fetching account balance for ${accountType} account...`);
  
  if (!apiToken) {
    throw new Error("API token is required.");
  }

  return new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
      ws.onopen = () => {
          ws.send(JSON.stringify({ "authorize": apiToken }));
      };
      ws.onmessage = (data) => {
          const response = JSON.parse(data.data);
          if (response.error) {
              reject(new Error(response.error.message));
          } else if (response.authorize) {
              // After authorize, send balance request on the same connection
              ws.send(JSON.stringify({ "balance": 1, "account": "all" }));
          } else if (response.balance) {
              resolve({
                  balance: response.balance.balance,
                  currency: response.balance.currency,
              });
              ws.close();
          }
      };
      ws.onerror = (err) => {
        reject(err);
        ws.close();
      };
  });
}


/**
 * Simulates fetching market data for a specific symbol.
 * @param symbol - The stock or asset ticker (e.g., 'PETR4').
 */
export async function getMarketData(symbol: string): Promise<MarketData> {
  console.log(`[Deriv Service] Fetching market data for: ${symbol}`);
  
  try {
     const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
     const response: any = await new Promise((resolve, reject) => {
         ws.onopen = () => {
            ws.send(JSON.stringify({ "ticks": symbol }));
         };
         ws.onmessage = (data) => {
            const res = JSON.parse(data.data);
             if (res.error) {
               reject(new Error(res.error.message || 'Unknown API error'));
               ws.close();
               return;
             }
            resolve(res);
            ws.close();
         };
         ws.onerror = (err) => reject(err);
     });

    if (response.tick) {
        return {
            symbol: response.tick.symbol,
            price: response.tick.quote,
            changePercent: 0 // Tick stream doesn't provide change percentage easily
        };
    }
     throw new Error("Invalid response for market data");
  } catch (error) {
    console.error(`[Deriv Service] Error fetching market data for ${symbol}:`, error);
    const mockPrice = parseFloat((Math.random() * (200 - 5) + 5).toFixed(2));
    const mockChange = parseFloat((Math.random() * 5 * (Math.random() > 0.5 ? 1 : -1)).toFixed(2));
    return {
        symbol,
        price: mockPrice,
        changePercent: mockChange,
    };
  }
}

export type ProposalRequest = {
    contractType: string;
    quantity: number;
    symbol: string;
    duration: number;
    duration_unit: DurationUnit;
};

// Helper function to send a proposal request and get the response
export async function requestProposal(
    ws: WebSocket,
    params: ProposalRequest,
    promisesRef: MutableRefObject<Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>>
): Promise<any> {
    const req_id = Date.now();
    const proposalRequest = {
        "proposal": 1,
        "amount": params.quantity,
        "basis": "stake",
        "contract_type": params.contractType,
        "currency": "USD",
        "duration": params.duration,
        "duration_unit": params.duration_unit,
        "symbol": params.symbol,
        "req_id": req_id
    };

    return new Promise((resolve, reject) => {
        promisesRef.current.set(String(req_id), { resolve, reject });
        ws.send(JSON.stringify(proposalRequest));
    });
}

// Helper function to buy a contract and get the response
export async function buyContract(
    ws: WebSocket,
    proposalId: string,
    price: number,
    promisesRef: MutableRefObject<Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>>
): Promise<any> {
    const req_id = Date.now();
    return new Promise((resolve, reject) => {
        promisesRef.current.set(String(req_id), { resolve, reject });
        ws.send(JSON.stringify({ "buy": proposalId, "price": price, "req_id": req_id }));
    });
}


/**
 * Fetches historical data. Prefers fetching by `count` for recent ticks, 
 * but falls back to `period` for longer-term simulations.
 * @param symbol The asset ticker.
 * @param period The time period (e.g., '1 year').
 * @param count The number of recent ticks to fetch.
 */
export async function getHistoricalData(symbol: string, period?: string, count?: number): Promise<any[]> {
    console.log(`[Deriv Service] Fetching historical data for ${symbol}. Count: ${count}, Period: ${period}.`);
    
    // Prioritize count for high-frequency data
    if (count) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay for ticks
        const data = [];
        let price = Math.random() * 200 + 50;
        
        for (let i = 0; i < count; i++) {
            const date = new Date();
            date.setSeconds(date.getSeconds() - (count - i));
            
            const trend = Math.sin(i / 20) * 0.1; // Short-term trend
            const volatility = (Math.random() - 0.5) * 0.5;
            price += trend + volatility;
            
            if (price < 1) price = 1;
            
            data.push({ date: date.toISOString(), price: parseFloat(price.toFixed(4)) });
        }
        return data;
    }

    // Fallback to period-based data for longer simulations
    await new Promise(resolve => setTimeout(resolve, 1200));
    const data = [];
    const endDate = new Date();
    
    let days;
    if (period && (period.includes("ano") || period.includes("year"))) {
        days = 365;
    } else if (period && (period.includes("mes") || period.includes("month"))) {
        days = 30 * (parseInt(period) || 1);
    } else {
        days = 30; // Default to 30 days if period is unclear
    }

    let price = Math.random() * 200 + 50;

    for (let i = 0; i < days; i++) {
        const date = new Date(endDate);
        date.setDate(date.getDate() - (days - i - 1));
        
        const trend = Math.sin(i / 50) * 0.5;
        const volatility = (Math.random() - 0.5) * 4;
        price += trend + volatility;

        if (price < 5) price = 5;
        
        data.push({ date: date.toISOString().split('T')[0], price: parseFloat(price.toFixed(2)) });
    }
    return data;
}
