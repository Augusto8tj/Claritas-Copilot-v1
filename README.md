# Robô de Trading com IA

Este é um projeto inicial Next.js integrado com Firebase Studio, desenvolvido para criar um robô de trading inteligente e adaptativo. Ele utiliza técnicas avançadas de IA e gestão de risco para otimizar operações financeiras.

## Funcionalidades Principais

*   **Laboratório de Evolução Genética:** Implementa o hook `useStrategyEvolution`, atuando como um cérebro de aprendizado contínuo. A cada 50 operações virtuais, o sistema identifica os robôs de pior desempenho e os substitui por "mutações" genéticas dos robôs de elite, garantindo que o conselho de robôs se adapte e melhore autonomamente.

*   **Consenso de Capital:** Os robôs não apenas opinam sobre a direção e o tempo das operações, mas também sugerem um valor de aposta (`stake`) proporcional à sua convicção. A aposta final é calculada como uma média ponderada destas sugestões, com ajustes baseados no risco atual do mercado.

*   **Gestão de Risco Temporal Aprimorada:** A duração do contrato é determinada dinamicamente. As sugestões de tempo de cada robô são convertidas para uma unidade comum (segundos), ponderadas pela confiança, e o resultado final é ajustado com base na volatilidade do mercado (usando indicadores como ATR e BBW). Em condições de mercado caóticas ou voláteis, o sistema pode reduzir o valor da aposta (`stake`) e aumentar a duração do contrato para maior proteção.

*   **"Meritocracia" (Voto Ponderado):** Um modo onde os votos dos robôs com melhor desempenho histórico têm um peso maior. Isso torna o sistema auto-otimizável e adaptativo, priorizando as análises mais confiáveis.

*   **Tomada de Decisão Autônoma:** O sistema avalia continuamente condições de mercado para tomar decisões críticas, como:
    *   Parar operações se o limite diário de perda for atingido ou a meta de lucro for alcançada ("VETO").
    *   Ajustar o `stake` e a duração do contrato em resposta à volatilidade do mercado.
    *   Aguardar condições de mercado mais favoráveis se o consenso não for forte o suficiente.

## Como Começar

Para iniciar, dê uma olhada em `src/app/page.tsx` para a página principal e em `src/app/help/page.tsx` para detalhes sobre as funcionalidades.

## Estrutura do Projeto

*   **`src/app/`**: Contém as páginas principais da aplicação e a lógica de roteamento e layout.
*   **`src/components/`**: Componentes de UI reutilizáveis, incluindo elementos de interface para trading, visualização de dados e componentes de layout.
*   **`src/hooks/`**: Hooks customizados do React para gerenciamento de estado e lógica complexa (ex: `useStrategyEvolution`, `useMarketData`).
*   **`src/lib/`**: Funções utilitárias, configurações globais e integrações com serviços de terceiros (ex: Firebase, Deriv API).
*   **`src/services/`**: Lógica de negócios e abstrações para interações com APIs externas e processamento de dados financeiros.
*   **`src/ai/`**: Ferramentas, fluxos de trabalho (flows) e configurações específicas para os módulos de Inteligência Artificial.

## Tecnologias Utilizadas

*   **Framework:** Next.js (com App Router)
*   **Linguagem:** TypeScript
*   **Estilização:** Tailwind CSS
*   **Backend/DB:** Firebase Studio
*   **API de Trading:** Deriv API (implícita pelos nomes dos serviços e hooks)

## Instalação

1.  Clone o repositório:
    \`\`\`bash
    git clone <url-do-repositorio>
    cd <nome-do-repositorio>
    \`\`\`
2.  Instale as dependências:
    \`\`\`bash
    npm install
    # ou
    yarn install
    \`\`\`
3.  **Configuração do Firebase:**
    *   Certifique-se de ter um projeto no Firebase configurado.
    *   Crie um arquivo `.env.local` na raiz do projeto com suas credenciais do Firebase. Exemplo:
        \`\`\`dotenv
        NEXT_PUBLIC_FIREBASE_API_KEY=SUA_API_KEY
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=SEU_AUTH_DOMAIN
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=SEU_PROJECT_ID
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=SEU_STORAGE_BUCKET
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=SEU_MESSAGING_SENDER_ID
        NEXT_PUBLIC_FIREBASE_APP_ID=SEU_APP_ID
        \`\`\`
    *   Se você estiver usando o Firebase Emulator Suite, configure as variáveis de ambiente correspondentes.

4.  **Configuração da Deriv API:**
    *   Obtenha as credenciais necessárias da Deriv API (geralmente um token de API).
    *   Armazene essas credenciais de forma segura, possivelmente em variáveis de ambiente (`.env.local` ou variáveis de sistema). Exemplo:
        \`\`\`dotenv
        DERIV_API_TOKEN=SEU_DERIV_API_TOKEN
        \`\`\`

## Uso

Execute o servidor de desenvolvimento:
\`\`\`bash
npm run dev
# ou
yarn dev
\`\`\`
Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

## Contribuição

Veja o arquivo `CONTRIBUTING.md` para detalhes sobre como contribuir para este projeto.

## Licença

Este projeto está licenciado sob a Licença MIT.
