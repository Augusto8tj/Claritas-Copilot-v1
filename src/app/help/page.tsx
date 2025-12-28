
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HelpPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Central de Ajuda
        </h1>
      </div>
      <p className="text-muted-foreground">
        Encontre respostas para suas perguntas sobre o Claritas Copilot.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Guia Completo do Aplicativo</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                Visão Geral e Autenticação
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>O Claritas Copilot é seu assistente financeiro pessoal, projetado para ajudá-lo a ter uma visão clara de suas finanças. O acesso é protegido por <strong>autenticação</strong>: crie uma conta ou faça login para acessar seus dados de forma segura. Você também pode gerenciar seu nome e foto na página de <strong>Perfil</strong>.</p>
                 <p className="pt-2"><strong>Nota sobre os Dados:</strong> Atualmente, o aplicativo funciona com dados de demonstração (mock) para que você possa explorar todos os recursos. Em uma versão futura, ele poderá se conectar a diversas fontes de dados, como bancos e corretoras, através de APIs de Open Banking.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                Painel Principal (Dashboard)
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>O <strong>Painel</strong> é a sua central de comando financeira. Aqui você encontra:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Insight do Copiloto de IA:</strong> Sugestões personalizadas geradas por IA para melhorar sua saúde financeira.</li>
                  <li><strong>Patrimônio Líquido:</strong> Um gráfico que mostra a evolução do seu patrimônio ao longo do tempo.</li>
                  <li><strong>Balanço Mensal:</strong> Uma visão rápida de suas receitas versus despesas para o mês atual.</li>
                  <li><strong>Acompanhamento de Metas:</strong> Um carrossel interativo para visualizar o progresso de todas as suas metas financeiras.</li>
                  <li><strong>Contas a Vencer:</strong> Uma lista de suas próximas contas para que você nunca perca um pagamento.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                Análise de Despesas
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                A página de <strong>Análise</strong> oferece um detalhamento dos seus gastos. O gráfico de pizza mostra a distribuição de suas despesas por categoria, enquanto a tabela exibe suas transações recentes. Para adicionar transações, use o <strong>Chat IA Claritas</strong> e peça, por exemplo, "Adicione um gasto de R$50 com Uber".
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                Orçamento Mensal (Interativo!)
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                A página de <strong>Orçamento</strong> ajuda você a manter seus gastos sob controle. Para cada categoria, você pode ver quanto já gastou em relação ao limite definido. Clique no ícone de lápis para <strong>editar os limites</strong> de cada categoria e personalizar seu planejamento financeiro. Os gastos são atualizados automaticamente conforme você adiciona novas transações.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                Metas Financeiras
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>Na seção de <strong>Metas</strong>, você pode criar, visualizar e deletar suas metas financeiras. Ao adicionar uma nova meta, a IA gera uma imagem inspiradora para representá-la!</p>
                <p>Use a ferramenta de <strong>Projeção de IA</strong> em cada meta para simular cenários e descobrir quanto tempo levará para atingir cada objetivo com base em suas contribuições e no retorno esperado dos seus investimentos.</p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-6">
              <AccordionTrigger className="text-lg font-semibold">
                Chatbots com Inteligência Artificial
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>O Claritas Copilot oferece dois assistentes de IA:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Chat com IA:</strong> Um chatbot para responder a perguntas gerais sobre finanças, conceitos de investimento, dicas de economia, etc.</li>
                  <li><strong>Chat IA Claritas:</strong> Uma versão avançada da IA que pode <strong>acessar os dados do seu aplicativo</strong>. Use-a para perguntar sobre seu orçamento ("como estão meus gastos com lazer?"), obter insights, adicionar transações, criar metas ou até mesmo consultar a cotação de uma ação ("qual o preço de PETR4?").</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-10">
              <AccordionTrigger className="text-lg font-semibold">
                Deriv Trader: Gráfico e Copiloto de IA
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                 <p>A página <strong>Deriv Trader</strong> é um ambiente de negociação integrado que transforma o Claritas num copiloto financeiro avançado. As funcionalidades foram recentemente evoluídas para um nível profissional de estabilidade e performance.</p>
                 <ol className="list-decimal pl-6 space-y-3">
                    <li>
                      <strong>Motor de Indicadores Centralizado:</strong> O coração do nosso sistema de trading é um motor que calcula, em tempo real, um conjunto completo de <strong>10 categorias de indicadores técnicos</strong>. Este motor alimenta tanto o gráfico que você vê quanto a lógica de decisão do Conselho de Robôs, garantindo consistência total dos dados. Os indicadores incluem RSI, Estocástico, MACD, Médias Móveis (SMA/EMA), Bandas de Bollinger, VWAP, ADX, Nuvem Ichimoku, e mais.
                    </li>
                    <li>
                      <strong>Gráfico de Trading Avançado (SVG):</strong>
                      <ul className="list-disc pl-6 mt-2 space-y-2">
                          <li><strong>Estabilidade e Responsividade:</strong> O gráfico agora é renderizado com tecnologia SVG, eliminando completamente os problemas de "quebra" ou desalinhamento das velas. Ele é 100% estável e responsivo, adaptando-se a qualquer tamanho de ecrã.</li>
                          <li><strong>Indicadores Controláveis:</strong> Através do botão "Indicadores", você pode ligar ou desligar individualmente a Média Móvel Simples (SMA), Exponencial (EMA), VWAP e as Bandas de Bollinger, com todos desligados por defeito para uma interface limpa.</li>
                          <li><strong>Gráfico de Volume:</strong> Um gráfico de barras separado abaixo do principal mostra o volume de negociação de cada período, ajudando a confirmar a força de uma tendência.</li>
                          <li><strong>Zoom com "Brush":</strong> Em vez de botões, use a área de "brush" na base do gráfico para selecionar uma janela de tempo e dar zoom, ou arraste-a para navegar pelo histórico do ativo de forma fluida.</li>
                          <li><strong>Crosshair e Snap de Preço:</strong> Uma mira vertical e horizontal segue o cursor com precisão, e uma etiqueta flutuante no eixo Y mostra o preço exato em tempo real, permitindo uma leitura imediata.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Copiloto de Trade em Ação:</strong>
                      <ul className="list-disc pl-6 mt-2">
                          <li>Ao clicar em <strong>"Analisar Desempenho"</strong>, a IA avalia o seu histórico de operações da sessão e fornece um resumo da sua performance com métricas chave.</li>
                      </ul>
                    </li>
                 </ol>
              </AccordionContent>
            </AccordionItem>

             <AccordionItem value="item-11">
                <AccordionTrigger className="text-lg font-semibold">
                    Mesa Operacional de IA (Arquitetura Técnica)
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed space-y-4">
                    <p>
                        A "Mesa Operacional de IA" é o sistema mais avançado do Claritas. Em vez de um único robô, ela simula uma "mesa de operações" hierárquica para tomar decisões de trading mais seguras e inteligentes. A arquitetura é dividida em fluxo de dados, uma camada de decisão por IA e uma camada de supervisão por lógica de programação.
                    </p>

                    <div>
                        <h4 className="font-semibold text-md mb-2">Fluxo de Dados e Motor de Indicadores</h4>
                        <p>
                            O sistema opera num fluxo de dados reativo e centralizado no hook `useRobotCouncil`:
                        </p>
                        <ol className="list-decimal pl-6 mt-2 space-y-2 text-sm">
                            <li><strong>Entrada de Dados:</strong> O hook `useDerivApi` estabelece a conexão WebSocket e recebe os dados brutos do mercado (`chartData`) em tempo real.</li>
                            <li><strong>Acionamento do Motor:</strong> Um `useEffect` no `useRobotCouncil` monitoriza continuamente o `chartData`. Qualquer novo "tick" (preço) aciona o motor de cálculo.</li>
                            <li><strong>Cálculo Centralizado:</strong> O motor lê a configuração de todos os robôs do `strategyCouncil` (ex: período 14 para RSI, 10/30 para médias móveis) e calcula todos os indicadores necessários de uma só vez, usando os dados mais recentes.</li>
                            <li><strong>Atualização de Estado:</strong> Os valores calculados (RSI, MACD, etc.) são armazenados no estado `indicators` do hook. Esta atualização desencadeia a próxima fase.</li>
                        </ol>
                    </div>
                    
                    <div>
                        <h4 className="font-semibold text-md mb-2">Camada 1: O Conselho de Votação (Decisão da IA)</h4>
                        <p>
                            Quando o estado `indicators` é atualizado, um segundo `useEffect` é acionado para realizar a votação.
                        </p>
                        <ul className="list-disc pl-6 mt-2 space-y-2 text-sm">
                            <li><strong>Formação do Conselho:</strong> Ao clicar em "Construir Conselho", a aplicação chama o fluxo Genkit `getStrategyCouncilFlow`, que pede à IA para criar as regras e parâmetros para 10 "analistas-robôs" de software, cada um especialista numa única filosofia de trading (RSI, MACD, etc.).</li>
                            <li><strong>Votação Individual:</strong> Para cada robô no conselho, a lógica de programação verifica se os indicadores atuais satisfazem as suas regras de entrada (ex: `indicators.rsi <= robot.strongBuyThreshold`).</li>
                            <li><strong>Atribuição de Voto:</strong> Com base na regra, é atribuído um voto ('RISE', 'FALL' ou 'HOLD') e uma pontuação de confiança ('strongConfidence' ou 'weakConfidence').</li>
                            <li><strong>Consolidação:</strong> Os votos e as confianças de todos os 10 robôs são somados para `riseConfidenceSum` e `fallConfidenceSum`.</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-md mb-2">Camada 2: O Comité de Supervisão (Governança por Código)</h4>
                        <p>
                           Se a soma de confiança de uma direção (`RISE` ou `FALL`) atingir o limiar de consenso, a decisão **não é final**. Ela passa por uma verificação final na função `supervisionCommitteeCheck`, que é lógica de programação fixa, não IA.
                        </p>
                        <ul className="list-disc pl-6 mt-2 space-y-2 text-sm">
                            <li><strong>Analista de Risco (Veto):</strong> Verifica a banca do dia (`dailyBalance`) e o alvo de lucro (`dailyTarget`). Se algum limite for atingido, ele **veta a operação**, devolvendo um `vetoReason`.</li>
                            <li><strong>Analista de Volatilidade (ATR):</strong> Mede a "turbulência" do mercado (ATR). Se estiver muito caótico, ele **reduz o valor da aposta (stake)** para diminuir o risco.</li>
                            <li><strong>Analista de Tendência (ADX):</strong> Mede a "clareza" da tendência (ADX). Se o mercado estiver lateral, também reduz o risco. Se houver uma tendência forte, pode manter ou aumentar a aposta.</li>
                            <li><strong>Execução Final:</strong> Apenas se não houver veto, a ordem é enviada para a API da Deriv com o `finalStake` ajustado.</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-md mb-2">Inteligência e Aprendizagem Contínua</h4>
                        <ul className="list-disc pl-6 mt-2 space-y-2 text-sm">
                            <li><strong>Meritocracia:</strong> Se ativada, os analistas com melhor histórico (guardado no `localStorage`) ganham mais "peso" no voto, tornando as suas opiniões mais influentes.</li>
                            <li><strong>Analista de Perdas:</strong> Sempre que uma operação do conselho resulta em prejuízo, uma IA "médico legista" (`analyzeTradeLossAction`) é acionada para analisar o que correu mal e fornecer uma sugestão. Essa sugestão pode ser usada na próxima vez que o conselho for formado, criando um ciclo de aprendizagem.</li>
                             <li><strong>Hall da Fama:</strong> A página "Hall da Fama" regista permanentemente os analistas que provaram ser os mais lucrativos e consistentes, permitindo-lhe ver quais estratégias funcionaram melhor ao longo do tempo.</li>
                        </ul>
                    </div>
                </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-12">
                <AccordionTrigger className="text-lg font-semibold">
                    Ficheiros da Mesa Operacional de IA
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed space-y-4">
                  <p>A "Mesa Operacional de IA" é um sistema composto por vários ficheiros chave que trabalham em conjunto. Aqui está um resumo das suas responsabilidades:</p>
                  <ul className="list-disc pl-6 space-y-3">
                    <li>
                      <strong className="font-mono">src/hooks/use-deriv-api.tsx</strong><br/>
                      A camada de comunicação. Estabelece a conexão WebSocket com a corretora, recebe os dados de mercado (`chartData`) e envia as ordens de negociação (`executeTrade`). É os "ouvidos" e as "mãos" do sistema.
                    </li>
                    <li>
                      <strong className="font-mono">src/hooks/use-robot-council.ts</strong><br/>
                      O cérebro da operação. Contém o motor de cálculo de todos os indicadores técnicos, a lógica de votação dos robôs, a chamada para formar o conselho via IA e o "Comité de Supervisão" para gestão de risco final.
                    </li>
                    <li>
                      <strong className="font-mono">src/app/actions/ai-actions.ts</strong><br/>
                      A ponte segura entre a aplicação (cliente) e os fluxos de IA (servidor). A função `getStrategyCouncilAction` aqui é chamada para solicitar a criação do conselho de robôs ao Genkit.
                    </li>
                     <li>
                      <strong className="font-mono">src/ai/flows/strategy-council-flow.ts</strong><br/>
                      O arquiteto da IA. Este fluxo Genkit contém o prompt detalhado que instrui o LLM sobre como criar as regras, parâmetros e justificações para cada um dos 10 robôs analistas.
                    </li>
                    <li>
                      <strong className="font-mono">src/app/deriv-trader/page.tsx</strong><br/>
                      A interface e o orquestrador. Esta página integra todos os hooks e componentes visuais, como o gráfico e o painel da Mesa Operacional, permitindo a interação do utilizador com o sistema.
                    </li>
                  </ul>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9">
              <AccordionTrigger className="text-lg font-semibold">
                Teste de Estratégias (Backtesting)
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>A página de <strong>Backtesting</strong> permite que você use a IA para simular estratégias de investimento antes de arriscar capital real.</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Descreva sua Estratégia:</strong> Você pode descrever uma estratégia em linguagem natural (ex: "Comprar PETR4 se a média móvel de 10 dias cruzar acima da de 30 dias"). A IA irá interpretar, buscar os dados históricos e simular o resultado.</li>
                    <li><strong>Analisar Robô MQL5:</strong> Se você já tem um robô de negociação (Expert Advisor) para a plataforma MetaTrader 5, pode colar o código-fonte (MQL5). A IA irá analisar o código, extrair a lógica da estratégia e preencher a descrição para que você possa simulá-la.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-lg font-semibold">
                Configurações
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>Na página de <strong>Configurações</strong>, você pode personalizar sua experiência:</p>
                 <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Conexão com Corretora:</strong> Insira seu token de API para habilitar funcionalidades de trading.</li>
                  <li><strong>Notificações:</strong> Gerencie suas preferências e envie um email de teste (registrado no console).</li>
                  <li><strong>Aparência:</strong> Altere o tema de cores e a fonte do aplicativo.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-8">
              <AccordionTrigger className="text-lg font-semibold">
                Configuração da Chave de API (Importante!)
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>Para que os recursos de Inteligência Artificial do Claritas Copilot funcionem, é crucial configurar sua chave de API do Google AI.</p>
                <p>Siga estes passos:</p>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>Obtenha uma chave de API no <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google AI Studio</a>.</li>
                  <li>No seu projeto, localize o arquivo chamado <code>.env</code>.</li>
                  <li>Dentro deste arquivo, adicione a seguinte linha, substituindo <code>"SUA_CHAVE_DE_API"</code> pela chave que você copiou: <br/><code>GEMINI_API_KEY="SUA_CHAVE_DE_API"</code></li>
                  <li>Salve o arquivo e reinicie o aplicativo para que as alterações tenham efeito.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
