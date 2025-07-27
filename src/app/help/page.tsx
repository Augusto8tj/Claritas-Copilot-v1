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
          <CardTitle className="font-headline">Guia do Aplicativo</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                Visão Geral
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                O Claritas Copilot é seu assistente financeiro pessoal, projetado para ajudá-lo a ter uma visão clara de suas finanças, acompanhar seu progresso em direção a metas e obter insights com a ajuda de inteligência artificial.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-7">
              <AccordionTrigger className="text-lg font-semibold">
                Como os Dados São Adicionados?
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                 <p>Para que o Claritas Copilot forneça insights precisos, ele precisa de seus dados financeiros. Em um ambiente de produção, os dados seriam adicionados de duas maneiras seguras:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Conexão via Open Banking:</strong> Você poderia conectar suas contas bancárias e de corretoras de forma segura. O aplicativo usaria acesso de apenas leitura para importar suas transações e saldos automaticamente, sem nunca poder movimentar seu dinheiro. Isso consolida as informações de diversas fontes em um só lugar.</li>
                  <li><strong>Entrada Manual:</strong> Para metas, orçamentos e outras informações específicas, você poderia adicionar os dados manualmente na plataforma.</li>
                </ul>
                <p className="pt-2"><strong>Nota:</strong> Atualmente, o aplicativo funciona com dados de demonstração (mock) para que você possa explorar todos os recursos sem precisar conectar dados reais.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                Painel Principal
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>O <strong>Painel</strong> é a sua central de comando financeira. Aqui você encontra:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Insight do Copiloto de IA:</strong> Sugestões personalizadas geradas por IA para melhorar sua saúde financeira.</li>
                  <li><strong>Patrimônio Líquido:</strong> Um gráfico que mostra a evolução do seu patrimônio ao longo do tempo.</li>
                  <li><strong>Balanço Mensal:</strong> Uma visão rápida de suas receitas versus despesas para o mês atual.</li>
                  <li><strong>Meta Principal:</strong> Acompanhe o progresso da sua meta financeira mais importante.</li>
                  <li><strong>Contas a Vencer:</strong> Uma lista de suas próximas contas para que você nunca perca um pagamento.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                Análise de Despesas
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                A página de <strong>Análise</strong> oferece um detalhamento dos seus gastos. O gráfico de pizza mostra a distribuição de suas despesas por categoria, enquanto a tabela exibe suas transações mais recentes, ajudando você a entender para onde seu dinheiro está indo.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                Metas Financeiras
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                Na seção de <strong>Metas</strong>, você pode visualizar e acompanhar o progresso de todas as suas metas financeiras. Use a ferramenta de projeção de IA para simular cenários e descobrir quanto tempo levará para atingir cada objetivo com base em suas contribuições.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                Chat com IA
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed">
                Converse com a Claritas, sua assistente financeira de IA. Faça perguntas sobre finanças, peça conselhos sobre orçamentos, investimentos ou qualquer outra dúvida financeira que você tenha. A versão "Insights" pode acessar os dados do aplicativo para respostas ainda mais personalizadas.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-6">
              <AccordionTrigger className="text-lg font-semibold">
                Configuração da Chave de API
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed space-y-2">
                <p>Para que os recursos de Inteligência Artificial do Claritas Copilot funcionem, é crucial configurar sua chave de API do Google AI.</p>
                <p>Siga estes passos:</p>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>Obtenha uma chave de API no <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google AI Studio</a>.</li>
                  <li>No seu projeto, localize o arquivo chamado <code>.env</code>.</li>
                  <li>Dentro deste arquivo, você encontrará uma linha: <code>GEMINI_API_KEY="YOUR_API_KEY"</code>.</li>
                  <li>Substitua <code>"YOUR_API_KEY"</code> pela chave de API que você copiou.</li>
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
