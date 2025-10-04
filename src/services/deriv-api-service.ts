'use server';

/**
 * @fileOverview Mock service for interacting with a brokerage API (e.g., Deriv).
 * In a real application, this would make actual authenticated API calls.
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

  return {
    balance: 10000, // Mock balance
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
 * @param action - 'buy' or 'sell'.
 * @param quantity - The amount of the asset to trade.
 */
export async function executeTrade(apiToken: string, symbol: string, action: 'buy' | 'sell', quantity: number): Promise<TradeResult> {
  console.log(`[Deriv Service] Executing ${action.toUpperCase()} order for ${quantity} of ${symbol}`);
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (apiToken.includes('invalid')) {
    return { success: false, message: 'Trade failed due to invalid API token.' };
  }

  return {
    success: true,
    orderId: `mock-order-${Date.now()}`,
    message: `Successfully executed ${action} order for ${quantity} of ${symbol}.`,
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
