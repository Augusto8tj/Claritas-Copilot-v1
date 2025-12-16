

'use server';

import WebSocket from 'ws';
import type { AccountType } from '@/hooks/use-deriv-api';

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

interface TradeResult {
  success: boolean;
  orderId?: string;
  message: string;
}

interface TradeOptions {
  allowEquals?: boolean;
}

export interface Asset {
  value: string;
  label: string;
}

export interface AssetGroup {
  label: string;
  options: Asset[];
}

const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089"; // Default App ID

/**
 * Connects to the Deriv WebSocket API, authenticates (if needed), and sends requests in sequence.
 * @param requests An array of JSON request objects to send.
 * @param apiToken Optional token for authorization. If provided, it will be the first request sent.
 * @returns A promise that resolves with the API response of the last request in the chain.
 */
function callDerivApi<T>(requests: object[], apiToken?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    let requestQueue = [...requests];
    
    // If a token is provided, prepend the authorize request.
    if (apiToken) {
        requestQueue.unshift({ "authorize": apiToken });
    }

    ws.on('open', () => {
      if (requestQueue.length > 0) {
        ws.send(JSON.stringify(requestQueue.shift()));
      }
    });

    ws.on('message', (data: WebSocket.Data) => {
      const response = JSON.parse(data.toString());

      if (response.error) {
        reject(new Error(response.error.message));
        ws.close();
        return;
      }
      
      // If this was the last expected response, resolve and close.
      if (requestQueue.length === 0) {
        resolve(response as T);
        ws.close();
        return;
      }

      // Send the next request in the queue.
      if (requestQueue.length > 0) {
         ws.send(JSON.stringify(requestQueue.shift()));
      }
    });

    ws.on('error', (error) => {
      reject(error);
      ws.close();
    });

    ws.on('close', (code, reason) => {
      console.log(`[Deriv WS] Connection closed: ${code} ${reason.toString()}`);
    });
  });
}


/**
 * Fetches the list of all available assets from the Deriv API.
 */
export async function getAvailableAssets(): Promise<AssetGroup[]> {
  console.log("[Deriv Service] Fetching available assets...");
  try {
    const response: any = await callDerivApi([
      {
        "active_symbols": "full",
        "product_type": "basic"
      }
    ]);

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

    // Convert to the format expected by the frontend
    const assetGroups: AssetGroup[] = Object.keys(groupedAssets).map(label => ({
      label,
      options: groupedAssets[label].sort((a,b) => a.label.localeCompare(b.label))
    })).sort((a, b) => a.label.localeCompare(b.label));
    
    console.log(`[Deriv Service] Found ${assetGroups.length} asset groups.`);
    return assetGroups;

  } catch (error) {
    console.error("[Deriv Service] Error fetching available assets:", error);
    // Return a default/fallback list in case of an error
    return [
      { label: "Erro", options: [{ value: "error", label: "Não foi possível carregar ativos" }] },
    ];
  }
}


/**
 * Simulates fetching the user's account balance from the broker.
 * @param apiToken - The user's API token for authentication.
 */
export async function getAccountBalance(apiToken: string): Promise<AccountBalance> {
  console.log(`[Deriv Service] Fetching account balance...`);
  
  if (!apiToken) {
    throw new Error("API token is required.");
  }

  const balanceRequest = { "balance": 1 };

  try {
    const response: any = await callDerivApi([balanceRequest], apiToken);
    
    if (response.balance) {
        return {
            balance: response.balance.balance,
            currency: response.balance.currency,
        };
    } else {
        console.warn("[Deriv Service] Balance not found in response.");
        throw new Error("Balance information not available in API response.");
    }
  } catch (error) {
    console.error("[Deriv Service] Error in getAccountBalance:", error);
    throw error;
  }
}


/**
 * Simulates fetching market data for a specific symbol.
 * @param symbol - The stock or asset ticker (e.g., 'PETR4').
 */
export async function getMarketData(symbol: string): Promise<MarketData> {
  console.log(`[Deriv Service] Fetching market data for: ${symbol}`);
  
  try {
    const response: any = await callDerivApi([
        {
            "ticks": symbol
        }
    ]);

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
    // Fallback to mock data on error
    const mockPrice = parseFloat((Math.random() * (200 - 5) + 5).toFixed(2));
    const mockChange = parseFloat((Math.random() * 5 * (Math.random() > 0.5 ? 1 : -1)).toFixed(2));
    return {
        symbol,
        price: mockPrice,
        changePercent: mockChange,
    };
  }
}

/**
 * Executes a trade order by authorizing, getting a proposal, and buying the contract in a single connection.
 * @param apiToken - The user's API token.
 * @param symbol - The asset to trade.
 * @param tradeDirection - 'rise' or 'fall'.
 * @param quantity - The amount of the asset to trade (stake).
 * @param options - Additional options like 'allowEquals'.
 */
export async function executeTrade(apiToken: string, symbol: string, tradeDirection: 'rise' | 'fall', quantity: number, options: TradeOptions = {}): Promise<TradeResult> {
  return new Promise((resolve, reject) => {
    const { allowEquals = false } = options;
    
    let contractType;
    if (tradeDirection === 'rise') {
        contractType = allowEquals ? 'CALLE' : 'CALL';
    } else { // 'fall'
        contractType = allowEquals ? 'PUTE' : 'PUT';
    }
  
    console.log(`[Deriv Service] Initiating trade for ${quantity} of ${symbol} (${contractType})`);

    if (!apiToken || apiToken.includes('invalid')) {
      return reject(new Error('Trade failed due to invalid API token.'));
    }

    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    let proposalId: string | null = null;
    let proposalPrice: number | null = null;

    ws.on('open', () => {
      console.log('[Deriv Service] Connection opened for trade execution.');
      ws.send(JSON.stringify({ "authorize": apiToken }));
    });

    ws.on('message', (data: WebSocket.Data) => {
      const response = JSON.parse(data.toString());

      if (response.error) {
        console.error('[Deriv Service] API Error during trade:', response.error);
        reject(new Error(response.error.message));
        ws.close();
        return;
      }

      const msgType = response.msg_type;

      if (msgType === 'authorize') {
        console.log('[Deriv Service] Authorized. Requesting proposal...');
        const proposalRequest = {
            "proposal": 1,
            "amount": quantity,
            "basis": "stake",
            "contract_type": contractType,
            "currency": "USD",
            "duration": 5,
            "duration_unit": "t",
            "symbol": symbol,
        };
        ws.send(JSON.stringify(proposalRequest));
      } else if (msgType === 'proposal') {
        if (!response.proposal || !response.proposal.id) {
          reject(new Error("Failed to get a valid proposal from the API."));
          ws.close();
          return;
        }
        proposalId = response.proposal.id;
        proposalPrice = response.proposal.ask_price;
        console.log(`[Deriv Service] Proposal received: ${proposalId}. Buying contract...`);
        
        ws.send(JSON.stringify({ "buy": proposalId, "price": proposalPrice }));

      } else if (msgType === 'buy') {
        if (response.buy && response.buy.contract_id) {
          console.log('[Deriv Service] Trade successful.');
          resolve({
              success: true,
              orderId: response.buy.contract_id,
              message: `Ordem do tipo "${contractType}" para ${symbol} no valor de ${quantity} USD executada com sucesso.`,
          });
        } else {
          reject(new Error("Buy request did not return a contract ID."));
        }
        ws.close();
      }
    });

    ws.on('error', (error) => {
      console.error('[Deriv Service] WebSocket error during trade:', error);
      reject(error);
      ws.close();
    });

    ws.on('close', () => {
      console.log('[Deriv Service] Trade connection closed.');
    });
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

  // Generate more realistic mock historical data
  const data = [];
  const endDate = new Date();
  
  let days;
  if (period.includes("ano") || period.includes("year")) {
      days = 365;
  } else if (period.includes("mes") || period.includes("month")) {
      days = 30 * (parseInt(period) || 1);
  } else {
      days = 30; // Default to 30 days
  }

  let price = Math.random() * 200 + 50; // Starting price

  for (let i = 0; i < days; i++) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - (days - i - 1));
    
    // Introduce some trend and volatility
    const trend = Math.sin(i / 50) * 0.5; // Slow-moving trend
    const volatility = (Math.random() - 0.5) * 4; // Daily random fluctuation
    price += trend + volatility;

    if (price < 5) price = 5; // Floor price
    
    data.push({ date: date.toISOString().split('T')[0], price: parseFloat(price.toFixed(2)) });
  }

  return data;
}

