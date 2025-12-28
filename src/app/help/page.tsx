
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
                      <strong>Motor de Indicadores Centralizado:</strong> O coração do nosso sistema de trading é um motor que calcula, em tempo real, um conjunto completo de <strong>22 categorias de indicadores técnicos</strong>. Este motor alimenta tanto o gráfico que você vê quanto a lógica de decisão do Conselho de Robôs, garantindo consistência total dos dados. Os indicadores incluem RSI, Estocástico, MACD, Médias Móveis (SMA/EMA), Bandas de Bollinger, VWAP, ADX, Nuvem Ichimoku, e mais.
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
                    A Orquestra Sinfónica da Mesa Operacional de IA
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed space-y-4">
                    <p>
                        A "Mesa Operacional" é o sistema mais avançado do Claritas. Em vez de um único robô, ela simula uma equipa profissional para tomar decisões de trading mais seguras e inteligentes. A arquitetura é dividida em três camadas hierárquicas.
                    </p>

                    <div>
                        <h4 className="font-semibold text-md mb-2">Camada 1: Os 22 Analistas Táticos (A Equipa)</h4>
                        <p className="text-sm">
                           São os especialistas de linha de frente. Cada um domina uma única estratégia (RSI, MACD, etc.). Eles analisam os indicadores em tempo real e emitem um "voto" (`RISE`, `FALL`, `HOLD`) com um nível de confiança. Pense neles como 22 analistas, cada um na sua secretária, focados no seu gráfico.
                        </p>
                    </div>
                    
                    <div>
                        <h4 className="font-semibold text-md mb-2">Camada 2: O Líder do Comité Tático (O Gestor de Turno)</h4>
                        <p className="text-sm">
                          Esta persona, representada pela função `committeeOfSpecialists`, não vota. Em vez disso, ele avalia as condições gerais do mercado (tendência, volatilidade) e **convoca apenas os especialistas mais qualificados** para a situação. Se o mercado está volátil, ele chama os especialistas em Bandas de Bollinger; se está em tendência, chama os de Médias Móveis. É o gestor de turno que organiza a equipa.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold text-md mb-2">Camada 3: O Comité de Supervisão e Risco (A Direção)</h4>
                        <p className="text-sm">
                          Esta é a camada final e mais poderosa (`supervisionCommitteeCheck`). Este comité recebe a recomendação do consenso, mas tem **poder de veto e de ajuste**. Ele responde a perguntas cruciais: "Já atingimos o nosso limite de perda ou a nossa meta de lucro do dia?" (se sim, **VETO**), ou "O mercado está demasiado caótico?" (se sim, **reduz o valor da aposta**). É a direção de risco que dá a aprovação final.
                        </p>
                    </div>
                </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-13">
              <AccordionTrigger className="text-lg font-semibold">
                A Arena Virtual: Meritocracia na Mesa Operacional
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-4">
                <p>Para elevar a inteligência do sistema, implementámos uma "Arena Virtual". Em vez de tratar todos os 22 analistas como iguais, criámos um sistema competitivo que promove os melhores em tempo real.</p>
                <div>
                    <h4 className="font-semibold text-md mb-2">Página "Mesa de Operações" e o Leaderboard</h4>
                    <p className="text-sm">
                      A nova página <strong>Mesa de Operações</strong> (`/trading-desk`) funciona como um *leaderboard* da sua equipa de IA. Para cada robô, ela mostra:
                    </p>
                    <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                      <li><strong>Estratégia e Parâmetros:</strong> A configuração atual do analista.</li>
                      <li><strong>Desempenho:</strong> Número de vitórias e derrotas na sessão.</li>
                      <li><strong>Taxa de Acerto:</strong> A percentagem de previsões corretas.</li>
                      <li><strong>Resultado Financeiro:</strong> O lucro ou prejuízo virtual que aquele robô gerou.</li>
                    </ul>
                </div>
                 <div>
                    <h4 className="font-semibold text-md mb-2">O Modo "Meritocracia"</h4>
                    <p className="text-sm">
                      Na interface da Mesa Operacional, você encontrará um interruptor para ativar a **Meritocracia**. Quando ligado, o sistema muda fundamentalmente a forma como os votos são contados:
                    </p>
                     <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                      <li><strong>Voto Ponderado:</strong> O voto de um robô com alto desempenho (alta taxa de acerto e lucro) passa a ter **mais peso** na decisão final.</li>
                      <li>**Auto-Otimização:** O sistema adapta-se automaticamente às condições de mercado. Se os robôs de tendência começam a perder pontos num mercado lateral, o seu peso diminui, e o peso dos robôs de oscilação (RSI, Estocástico) aumenta, tornando o sistema mais inteligente.</li>
                    </ul>
                </div>
                 <div>
                    <h4 className="font-semibold text-md mb-2">Hall da Fama</h4>
                    <p className="text-sm">
                      Os robôs que atingem um desempenho excecional (alto número de vitórias e lucro positivo) são promovidos para a página <strong>Hall da Fama</strong>, um registo permanente dos seus analistas de IA mais lendários.
                    </p>
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
                      <strong className="font-mono">src/ai/flows/strategy-council-flow.ts</strong><br/>
                      O arquiteto da IA. Este fluxo Genkit contém o prompt detalhado que instrui o LLM sobre como criar as regras, parâmetros e justificações para cada um dos 22 robôs analistas.
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
