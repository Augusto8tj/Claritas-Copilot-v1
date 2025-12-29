import { config } from 'dotenv';
config();

// Flows in use
import '@/ai/flows/asset-analysis-flow.ts';
import '@/ai/flows/financial-chatbot-insights.ts';
import '@/ai/flows/goal-image-generation.ts';
import '@/ai/flows/mql-analyzer-flow.ts';
import '@/ai/flows/operation-analysis-flow.ts';

// Deprecated flows (will be removed)
// import '@/ai/flows/goal-projection.ts';
// import '@/ai/flows/financial-insights.ts-';
// import '@/ai/flows/strategy-backtest-flow.ts';
// import '@/ai/flows/strategy-council-flow.ts';
// import '@/ai/flows/auto-trader-strategy-flow.ts';
// import '@/ai/flows/trade-loss-analyzer-flow.ts';
