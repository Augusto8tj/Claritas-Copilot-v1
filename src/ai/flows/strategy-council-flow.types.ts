import { z } from 'zod';

export const StrategyCouncilInputSchema = z.object({
  symbol: z.string().describe("The trading symbol for which to create the council."),
  balance: z.number().describe("The user's designated trading balance for the day for risk management."),
  currency: z.string().describe("The currency of the account balance."),
  historicalDataJson: z.string().describe("A JSON string of recent historical price data for market analysis."),
});
export type StrategyCouncilInput = z.infer<typeof StrategyCouncilInputSchema>;


const BaseRobotSchema = z.object({
  id: z.string().describe("A unique identifier for the robot (e.g., 'RSI_BOT_1')."),
  strategyType: z.string().describe("The type of strategy the robot uses (e.g., 'RSI', 'STOCHASTIC', 'MOVING_AVERAGE_CROSS')."),
  justification: z.string().describe("A brief justification for why this robot and its parameters were chosen for the current market conditions."),
  suggestedStake: z.number().describe("The suggested stake for trades executed by this robot, calculated based on the provided daily balance."),
  suggestedDuration: z.number().describe("The suggested trade duration in ticks."),
});

const RsiRobotSchema = BaseRobotSchema.extend({
  strategyType: z.literal('RSI'),
  buyThreshold: z.number().describe("The RSI value below which a 'RISE' vote is cast."),
  sellThreshold: z.number().describe("The RSI value above which a 'FALL' vote is cast."),
});

const StochRobotSchema = BaseRobotSchema.extend({
    strategyType: z.literal('STOCHASTIC'),
    buyThreshold: z.number().describe("The Stochastic value below which a 'RISE' vote is cast."),
    sellThreshold: z.number().describe("The Stochastic value above which a 'FALL' vote is cast."),
});

const MACrossRobotSchema = BaseRobotSchema.extend({
    strategyType: z.literal('MOVING_AVERAGE_CROSS'),
    shortPeriod: z.number().describe("The period for the short-term moving average."),
    longPeriod: z.number().describe("The period for the long-term moving average."),
});


export const RobotStrategySchema = z.union([RsiRobotSchema, StochRobotSchema, MACrossRobotSchema]);
export type RobotStrategy = z.infer<typeof RobotStrategySchema>;


export const StrategyCouncilOutputSchema = z.object({
  council: z.array(RobotStrategySchema).min(3).max(3).describe("An array of 3 distinct robot analyst strategies."),
});
export type StrategyCouncilOutput = z.infer<typeof StrategyCouncilOutputSchema>;
