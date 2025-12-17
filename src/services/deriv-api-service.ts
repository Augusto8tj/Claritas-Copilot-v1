

'use server';

import WebSocket from 'ws';
import type { AccountType } from '@/hooks/use-deriv-api';
import type { MutableRefObject } from 'react';

/**
 * @fileOverview Service for interacting with the Deriv brokerage API.
 */

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

const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089";

// This is a generic function now, for simple, single-request API calls.
function callDerivApi<T>(request: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    
    ws.on('open', () => {
        ws.send(JSON.stringify(request));
    });

    ws.on('message', (data: WebSocket.Data) => {
      const response = JSON.parse(data.toString());
      if (response.error) {
        reject(new Error(response.error.message));
      } else {
        resolve(response as T);
      }
      ws.close();
    });

    ws.on('error', (error) => {
      reject(error);
      ws.close();
    });
  });
}


/**
 * Fetches the list of all available assets from the Deriv API.
 */
export async function getAvailableAssets(): Promise<AssetGroup[]> {
  console.log("[Deriv Service] Fetching available assets...");
  try {
    const response: any = await callDerivApi(
      {
        "active_symbols": "full",
        "product_type": "basic"
      }
    );

    if (!response.active_symbols) {
      throw new Error("Invalid response from active_symbols");
    }

    const groupedAssets: { [key: string]: Asset[] } = {};

    for (const symbol of response.active_symbols) {
        const market = symbol.market_display_name;
        if (!groupedAssets[market]) {
            groupedAssets[market] = [];
        }
        groupedAssets[market].push({
            value: symbol.symbol,
            label: symbol.display_name
        });
    }

    const assetGroups: AssetGroup[] = Object.keys(groupedAssets).map(label => ({
      label,
      options: groupedAssets[label].sort((a,b) => a.label.localeCompare(b.label))
    })).sort((a, b) => a.label.localeCompare(b.label));
    
    console.log(`[Deriv Service] Found ${assetGroups.length} asset groups.`);
    return assetGroups;

  } catch (error) {
    console.error("[Deriv Service] Error fetching available assets:", error);
    return [
      { label: "Erro", options: [{ value: "error", label: "Não foi possível carregar ativos" }] },
    ];
  }
}


/**
 * Fetches the user's account balance from the broker.
 * @param apiToken - The user's API token for authentication.
 */
export async function getAccountBalance(apiToken: string): Promise<AccountBalance> {
  console.log(`[Deriv Service] Fetching account balance...`);
  
  if (!apiToken) {
    throw new Error("API token is required.");
  }

  return new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
      ws.onopen = () => {
          ws.send(JSON.stringify({ "authorize": apiToken }));
      };
      ws.onmessage = (data) => {
          const response = JSON.parse(data.toString());
          if (response.error) {
              reject(new Error(response.error.message));
          } else if (response.authorize) {
              resolve({
                  balance: response.authorize.balance,
                  currency: response.authorize.currency,
              });
          }
          ws.close();
      };
      ws.onerror = (err) => reject(err);
  });
}


/**
 * Simulates fetching market data for a specific symbol.
 * @param symbol - The stock or asset ticker (e.g., 'PETR4').
 */
export async function getMarketData(symbol: string): Promise<MarketData> {
  console.log(`[Deriv Service] Fetching market data for: ${symbol}`);
  
  try {
    const response: any = await callDerivApi(
        {
            "ticks": symbol
        }
    );

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

type ProposalRequest = {
    contractType: string;
    quantity: number;
    symbol: string;
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
        "duration": 5,
        "duration_unit": "t",
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
 * Simulates fetching historical data for backtesting.
 * @param symbol The asset ticker.
 * @param period The time period (e.g., '1 year').
 */
export async function getHistoricalData(symbol: string, period: string): Promise<any[]> {
  console.log(`[Deriv Service] Fetching historical data for ${symbol} over ${period}.`);
  await new Promise(resolve => setTimeout(resolve, 1200));

  const data = [];
  const endDate = new Date();
  
  let days;
  if (period.includes("ano") || period.includes("year")) {
      days = 365;
  } else if (period.includes("mes") || period.includes("month")) {
      days = 30 * (parseInt(period) || 1);
  } else {
      days = 30;
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
