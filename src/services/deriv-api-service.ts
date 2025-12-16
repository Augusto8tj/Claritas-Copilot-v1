'use server';

import WebSocket from 'ws';

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
 * Connects to the Deriv WebSocket API and sends a request.
 * @param request The JSON request object to send.
 * @returns A promise that resolves with the API response.
 */
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
    const response: any = await callDerivApi({
        "active_symbols": "full",
        "product_type": "basic"
    });

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
  console.log(`[Deriv Service] Fetching account balance with token: ${apiToken.substring(0, 5)}...`);
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  if (apiToken.includes('invalid')) {
    throw new Error('Invalid API Token');
  }

  // Use the provided real token for balance check
  if (apiToken === 'URTTMpEMpZY8e5U') {
     const response: any = await callDerivApi({
        "balance": 1,
        "subscribe": 0,
        "account": "real"
     });
     return {
        balance: response.balance.balance,
        currency: response.balance.currency,
     };
  }

  // Default mock balance for other tokens (like demo)
  return {
    balance: 10000,
    currency: 'USD',
  };
}

/**
 * Simulates fetching market data for a specific symbol.
 * @param symbol - The stock or asset ticker (e.g., 'PETR4').
 */
export async function getMarketData(symbol: string): Promise<MarketData> {
  console.log(`[Deriv Service] Fetching market data for: ${symbol}`);
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const mockPrice = parseFloat((Math.random() * (200 - 5) + 5).toFixed(2));
  const mockChange = parseFloat((Math.random() * 5 * (Math.random() > 0.5 ? 1 : -1)).toFixed(2));

  return {
    symbol,
    price: mockPrice,
    changePercent: mockChange,
  };
}

/**
 * Simulates executing a trade order.
 * @param apiToken - The user's API token.
 * @param symbol - The asset to trade.
 * @param tradeDirection - 'rise' or 'fall'.
 * @param quantity - The amount of the asset to trade (stake).
 * @param options - Additional options like 'allowEquals'.
 */
export async function executeTrade(apiToken: string, symbol: string, tradeDirection: 'rise' | 'fall', quantity: number, options: TradeOptions = {}): Promise<TradeResult> {
  const { allowEquals = false } = options;

  let contractType;
  if (tradeDirection === 'rise') {
    contractType = allowEquals ? 'PUTE' : 'PUT';
  } else { // 'fall'
    contractType = allowEquals ? 'CALLE' : 'CALL';
  }
  
  console.log(`[Deriv Service] Executing order for ${quantity} of ${symbol}`);
  console.log(`[Deriv Service] -> Direction: ${tradeDirection}`);
  console.log(`[Deriv Service] -> Contract Type: ${contractType}`);

  // 1. Simulate getting a proposal
  console.log(`[Deriv Service] Step 1: Requesting proposal with contract_type: ${contractType}`);
  await new Promise(resolve => setTimeout(resolve, 400));
  const proposalId = `mock-proposal-${Date.now()}`;
  console.log(`[Deriv Service] -> Proposal ID received: ${proposalId}`);

  // 2. Simulate buying the contract
  if (apiToken.includes('invalid')) {
    return { success: false, message: 'Trade failed due to invalid API token.' };
  }
  
  console.log(`[Deriv Service] Step 2: Buying contract with proposal ID: ${proposalId}`);
  await new Promise(resolve => setTimeout(resolve, 600));
  const contractId = `mock-contract-${Date.now()}`;
  console.log(`[Deriv Service] -> Contract ID received: ${contractId}`);

  return {
    success: true,
    orderId: contractId,
    message: `Ordem do tipo "${contractType}" para ${symbol} no valor de ${quantity} executada com sucesso.`,
  };
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
