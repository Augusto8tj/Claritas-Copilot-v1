
'use server';

/**
 * @fileOverview An AI flow for creating a council of specialized trading robots.
 * 
 * - getStrategyCouncil - The main flow function to build the council.
 */
import { ai } from '@/lib/genkit';
import { z } from 'zod';
import { StrategyCouncilInputSchema, StrategyCouncilOutputSchema, type StrategyCouncilInput } from './strategy-council-flow.types';

const strategyPrompt = ai.definePrompt({
  name: 'strategyCouncilPrompt',
  input: { schema: StrategyCouncilInputSchema },
  output: { schema: StrategyCouncilOutputSchema },
  system: `Você é o "Mestre Calibrador", um Diretor Quantitativo de uma mesa de operações de elite. Sua tarefa é construir e calibrar um CONSELHO de 22 robôs analistas para operar o ativo {{{symbol}}}. Cada robô é um especialista com uma única estratégia.

A sua calibração DEVE ser otimizada para o HORIZONTE DE TEMPO fornecido: {{{timePeriod}}}.

Use esta MATRIZ DE CALIBRAÇÃO como sua bíblia. É inegociável.

**1. HFT / SCALPING (Horizontes: '1m', '2m', '3m', '5m' ou 't' para ticks)**
   - **Filosofia:** Reação rápida, reversão à média, captura de ruído.
   - **RSI/STOCH:** Períodos curtos (7-10). Limiares agressivos (ex: 20/80) para detectar sobre-extensão rápida.
   - **Médias Móveis:** Quase inúteis para direção, mas uma média muito curta (ex: EMA 9) serve como suporte/resistência imediata. O preço deve respeitá-la.
   - **Bollinger:** Período curto (15). A lógica é "fading the edges" - vender quando toca a banda superior, comprar quando toca a inferior.
   - **ADX:** Inútil. Ignorar.
   - **MACD:** Usar configurações rápidas (ex: 5, 13, 3) e focar no HISTOGRAMA para divergências de momentum.
   - **Price Action:** ESSENCIAL. Procurar por Martelos/Estrelas Cadentes perto das bandas de bollinger.
   - **VWAP/POC:** Servem como ímãs de preço. O preço tende a voltar para eles.
   - **Stake/Duração:** Stakes BAIXOS, duração em TICKS (5 a 7).

**2. INTRADAY TREND (Horizontes: '10m', '15m', '30m', '1h')**
   - **Filosofia:** Capturar a tendência principal da sessão (Londres/NY).
   - **RSI/STOCH:** Períodos padrão (14). A lógica muda para "trend following": RSI > 55 é compra, < 45 é venda. Ignorar sobrecompra/venda, a menos que seja extremo (>85).
   - **Médias Móveis:** ESSENCIAL. Cruzamentos de médias médias (ex: 10/20 ou 20/50) confirmam a direção do dia.
   - **Bollinger:** A lógica muda para "walking the bands" - se o preço está subindo e "caminhando" pela banda superior, é um sinal de COMPRA forte.
   - **ADX:** CRÍTICO. Se ADX > 25, a tendência é forte. Use a direção do DI+/DI-. Se ADX < 20, o mercado está lateral; robôs de tendência devem dar HOLD.
   - **MACD:** Usar padrão (12, 26, 9). O cruzamento da linha de sinal confirma a tendência.
   - **Ichimoku:** O rompimento da Nuvem (Kumo) é um sinal poderoso de tendência para as próximas horas.
   - **Stake/Duração:** Stakes MÉDIOS, duração em MINUTOS (1 a 5).

**3. SWING / MACRO (Horizontes: '8h', '1d')**
   - **Filosofia:** Capturar grandes ciclos de mercado que duram dias ou semanas.
   - **RSI/STOCH:** Períodos longos (21). Apenas divergências MACRO importam (ex: preço faz topo mais alto, RSI faz topo mais baixo).
   - **Médias Móveis:** O SINAL PRINCIPAL. Usar o "Golden Cross" / "Death Cross" (50/200) como o principal indicador de ciclo de mercado.
   - **Bollinger:** Usado para identificar topos/fundos de mercado em forma de "M" ou "W".
   - **ADX:** Útil para confirmar a "saúde" da tendência macro.
   - **OBV:** CRÍTICO. Divergências no OBV indicam acumulação/distribuição institucional antes do movimento do preço.
   - **Chandelier/SAR:** Usado como trailing stop para "deixar os lucros correrem".
   - **Stake/Duração:** Stakes ALTOS, duração em HORAS ou DIAS.

**Sua Tarefa:**
1. Determine o estilo de trading a partir do horizonte de tempo.
2. Para CADA um dos 22 robôs, defina os parâmetros exatos (períodos, limiares) de acordo com a matriz acima.
3. Forneça uma justificativa concisa para cada robô, explicando PORQUÊ aqueles parâmetros foram escolhidos para AQUELE horizonte de tempo.
4. Calcule um stake sugerido seguro (1-2% da banca diária) e uma duração apropriada.
5. Retorne a estrutura JSON completa para os 22 robôs.`,
  prompt: `
HORIZONTE DE TEMPO ATUAL: {{{timePeriod}}}
BANCA DIÁRIA (para gestão de risco): {{{balance}}} {{{currency}}}
ATIVO: {{{symbol}}}
DURAÇÃO BASE DO CONTRATO: {{{durationUnit}}}

Construa o conselho de 22 robôs analistas. Seja rigoroso com a calibração.
`
});

const getStrategyCouncilFlow = ai.defineFlow(
  {
    name: 'getStrategyCouncilFlow',
    inputSchema: StrategyCouncilInputSchema,
    outputSchema: StrategyCouncilOutputSchema,
  },
  async (input) => {
    
    // O prompt já tem o schema de output, então o Genkit irá formatar a saída.
    const { output } = await strategyPrompt(input);
    
    if (!output || !output.council || output.council.length < 22) {
      throw new Error("A IA não conseguiu construir um conselho de analistas completo e calibrado.");
    }
    
    return output;
  }
);


export async function getStrategyCouncil(input: StrategyCouncilInput): Promise<StrategyCouncilOutput> {
  return getStrategyCouncilFlow(input);
}
