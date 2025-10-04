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

            <AccordionItem value="item-9">
              <AccordionTrigger className="text-lg font-semibold">
                Integração com Corretora (Plano Futuro)
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>Esta é a próxima grande evolução do Claritas Copilot: transformar-se em um agente financeiro que pode interagir com o mercado. A arquitetura para isso está sendo construída:</p>
                 <ol className="list-decimal pl-6 space-y-2">
                    <li><strong>Conexão Segura:</strong> Na página de <strong>Configurações</strong>, você pode inserir seu token de API de uma corretora como a Deriv. Este token é a chave que permite ao Claritas acessar sua conta de forma segura e com permissões controladas por você (ex: apenas leitura ou negociação).</li>
                    <li><strong>Serviço Dedicado:</strong> Um serviço interno (`deriv-api-service.ts`) será responsável por toda a comunicação com a API da corretora, como buscar saldos, histórico e executar ordens.</li>
                    <li><strong>Ferramentas de Negociação para a IA:</strong> A Claritas IA receberá novas ferramentas (`trading-tools`) para interagir com o serviço da corretora. Ela poderá, por exemplo, verificar sua carteira ou executar uma ordem de compra/venda (sempre com sua aprovação final).</li>
                    <li><strong>Agente Inteligente:</strong> Com essas ferramentas, a IA poderá testar estratégias ("backtesting"), simular investimentos e até mesmo sugerir operações com base em análises de mercado, transformando-se em um verdadeiro copiloto de investimentos.</li>
                 </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-lg font-semibold">
                Configurações
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>Na página de <strong>Configurações</strong>, você pode personalizar sua experiência:</p>
                 <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Conexão com Corretora:</strong> Insira seu token de API para habilitar futuras funcionalidades de trading.</li>
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
