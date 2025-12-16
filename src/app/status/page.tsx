import { HealthCheckCard } from "@/components/status/health-check-card";
import { checkDerivConnection, checkGeminiConnection } from "@/app/actions";

export const revalidate = 0; // Disable cache for this page

export default async function StatusPage() {
  
  // As server components, these will run on the server each time the page is loaded.
  const geminiResult = await checkGeminiConnection();
  
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Status do Sistema
        </h1>
      </div>
      <p className="text-muted-foreground">
        Verifique a saúde das conexões e serviços essenciais do Claritas Copilot.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <HealthCheckCard
          serviceName="API Gemini (IA)"
          checkResult={geminiResult}
          description="Essencial para todos os recursos de Inteligência Artificial, como chatbots e análises."
          successMessage="A conexão com a API do Google Gemini está funcionando corretamente."
          failureMessage="A chave da API do Gemini não está configurada ou é inválida."
          configurePath="/settings"
        />
        
        {/* The Deriv check is client-side because it needs the token from localStorage */}
        <HealthCheckCard
          isClientSide
          serviceName="API Deriv (Corretora)"
          clientCheckAction={checkDerivConnection}
          description="Necessária para negociação, consulta de saldo e dados de mercado em tempo real."
          successMessage="A conexão com a API da Deriv está funcionando corretamente."
          failureMessage="O token da API da Deriv não está configurado ou é inválido."
          configurePath="/settings"
        />
      </div>
    </div>
  );
}
