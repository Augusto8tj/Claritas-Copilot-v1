

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
      
      // If this was the authorize response, just continue to the next request.
      if (response.msg_type === 'authorize' && requestQueue.length > 0) {
        ws.send(JSON.stringify(requestQueue.shift()));
        return;
      }
      
      // If this was the last expected response, resolve and close.
      if (requestQueue.length === 0) {
        resolve(response as T);
        ws.close();
        return;
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
 * Fetches the user's account balance from the broker.
 * @param apiToken - The user's API token for authentication.
 * @param accountType - The type of account to fetch balance for ('demo' or 'real').
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
 * @param contractType - The type of contract ('CALL', 'PUT', 'CALLE', 'PUTE').
 * @param quantity - The amount of the asset to trade (stake).
 */
export async function executeTrade(apiToken: string, symbol: string, contractType: string, quantity: number): Promise<TradeResult> {
  console.log(`[Deriv Service] Initiating trade for ${quantity} of ${symbol} (${contractType})`);

  if (!apiToken || apiToken.includes('invalid')) {
    throw new Error('O token da API da Deriv não é válido ou não foi configurado.');
  }

  try {
    // Step 1: Get a proposal
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
    
    console.log("[Deriv Service] Requesting proposal...");
    const proposalResponse: any = await callDerivApi([proposalRequest], apiToken);

    if (!proposalResponse.proposal || !proposalResponse.proposal.id) {
      throw new Error("Falha ao obter uma proposta de negociação da API.");
    }

    const proposalId = proposalResponse.proposal.id;
    const price = proposalResponse.proposal.ask_price;
    console.log(`[Deriv Service] Proposal received: ${proposalId}. Buying contract...`);

    // Step 2: Buy the contract using the proposal ID
    const buyRequest = { "buy": proposalId, "price": price };
    const buyResponse: any = await callDerivApi([buyRequest], apiToken);

    if (buyResponse.buy && buyResponse.buy.contract_id) {
      console.log('[Deriv Service] Trade successful.');
      return {
          success: true,
          orderId: buyResponse.buy.contract_id,
          message: `Ordem do tipo "${contractType}" para ${symbol} no valor de ${quantity} USD executada com sucesso.`,
      };
    } else {
      throw new Error("A resposta da compra não continha um ID de contrato válido.");
    }
  } catch (error) {
    console.error('[Deriv Service] Erro durante a execução da negociação:', error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error("Ocorreu um erro desconhecido durante a negociação.");
  }
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
