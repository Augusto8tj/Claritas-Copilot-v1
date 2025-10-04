### Prompt Detalhado para Replicar o Sistema de IA

**Objetivo:** Construir um assistente de IA conversacional dentro de um aplicativo Next.js, capaz de interagir com os dados internos da aplicação de forma segura e eficiente usando ferramentas (tools).

**Tecnologias Principais:**
*   **Framework:** Next.js (com App Router)
*   **Linguagem:** TypeScript
*   **Componentes de UI:** shadcn/ui
*   **Estilização:** Tailwind CSS
*   **Orquestração de IA:** Google Genkit
*   **Comunicação Frontend-Backend:** Next.js Server Actions

---

#### **Passo 1: Estrutura de Arquivos**

Crie a seguinte estrutura de diretórios para organizar o código da IA e os serviços de dados:

```
/src
|-- /ai
|   |-- /flows       # Onde cada fluxo de IA (lógica principal) será definido.
|   |-- /tools       # Onde as ferramentas que a IA pode usar serão definidas.
|   `-- genkit.ts    # Configuração e inicialização do Genkit.
|-- /app
|   `-- actions.ts   # Server Actions para conectar a UI aos fluxos de IA.
|-- /components
|   `-- /chat        # Componentes React para a interface de chat.
`-- /services
    `-- data-service.ts # Simula o acesso ao banco de dados e a lógica de negócios.
```

---

#### **Passo 2: Configuração do Genkit (`src/ai/genkit.ts`)**

Configure uma instância global do Genkit. Isso define o modelo de linguagem padrão e os plugins necessários.

```typescript
// src/ai/genkit.ts
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai'; // Use @genkit-ai/google-genai se disponível

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash', // ou outro modelo Gemini
});
```

---

#### **Passo 3: Criação dos Serviços de Dados (`src/services/data-service.ts`)**

Crie funções que simulem o acesso e a manipulação dos dados da sua aplicação. A IA não acessará o "banco de dados" diretamente; ela usará ferramentas que chamam essas funções.

```typescript
// src/services/data-service.ts
'use server';

// Exemplo: Obter um resumo dos dados
export async function getSummary() {
  // Em um app real, buscaria dados de um banco de dados.
  console.log('Buscando resumo dos dados...');
  return {
    totalUsers: 150,
    activeProjects: 12,
  };
}

// Exemplo: Adicionar um novo item
export async function addItem(itemName: string, quantity: number) {
  // Lógica para adicionar o item ao banco de dados.
  console.log(`Adicionando ${quantity} de ${itemName}...`);
  return `Item "${itemName}" adicionado com sucesso.`;
}
```

---

#### **Passo 4: Definição das Ferramentas da IA (`src/ai/tools/app-tools.ts`)**

Crie "ferramentas" que a IA poderá usar. Cada ferramenta é uma função que a IA pode decidir chamar para obter informações ou executar ações. Essas ferramentas são wrappers em torno das suas funções de serviço.

```typescript
// src/ai/tools/app-tools.ts
'use server';

import { ai } from '@/ai/genkit';
import { getSummary, addItem } from '@/services/data-service';
import { z } from 'zod';

// Ferramenta para obter resumo
export const getSummaryTool = ai.defineTool(
  {
    name: 'getSummaryTool',
    description: 'Obtém um resumo estruturado dos dados da aplicação, como total de usuários e projetos.',
    inputSchema: z.object({}), // Sem input
    outputSchema: z.object({
        totalUsers: z.number(),
        activeProjects: z.number(),
    }),
  },
  async () => {
    return getSummary();
  }
);

// Ferramenta para adicionar um item
export const addItemTool = ai.defineTool(
  {
    name: 'addItemTool',
    description: 'Adiciona um novo item ao inventário.',
    inputSchema: z.object({
      itemName: z.string().describe('O nome do item a ser adicionado.'),
      quantity: z.number().describe('A quantidade do item.'),
    }),
    outputSchema: z.string(), // Mensagem de sucesso/erro
  },
  async ({ itemName, quantity }) => {
    return addItem(itemName, quantity);
  }
);
```

---

#### **Passo 5: Criação do Fluxo de IA (`src/ai/flows/chatbot-flow.ts`)**

Defina o "cérebro" do chatbot. Este é o fluxo principal que recebe a consulta do usuário e usa as ferramentas disponíveis para formular uma resposta.

```typescript
// src/ai/flows/chatbot-flow.ts
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getSummaryTool, addItemTool } from '../tools/app-tools'; // Importa as ferramentas

// Define o schema da conversa (histórico)
const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

// Define o schema de entrada do fluxo
export const ChatbotInputSchema = z.object({
  history: z.array(MessageSchema).describe('O histórico da conversa.'),
  query: z.string().describe('A nova pergunta do usuário.'),
});
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;

// Define o schema de saída do fluxo
export const ChatbotOutputSchema = z.object({
  response: z.string().describe('A resposta gerada pela IA.'),
});
export type ChatbotOutput = z.infer<typeof ChatbotOutputSchema>;

// Cria o prompt do Genkit
const prompt = ai.definePrompt({
  name: 'chatbotPrompt',
  input: { schema: ChatbotInputSchema },
  output: { schema: ChatbotOutputSchema },
  tools: [getSummaryTool, addItemTool], // Disponibiliza as ferramentas para a IA
  system: `Você é um assistente de IA prestativo. Use as ferramentas disponíveis para responder às perguntas do usuário e executar ações. Seja sempre claro e conciso.`,
  prompt: `Histórico da Conversa:
{{#each history}}
- {{role}}: {{content}}
{{/each}}

Nova Pergunta: {{{query}}}
`,
});

// Define o fluxo principal
const chatbotFlow = ai.defineFlow(
  {
    name: 'chatbotFlow',
    inputSchema: ChatbotInputSchema,
    outputSchema: ChatbotOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

// Função de exportação que será chamada pela Server Action
export async function runChatbot(input: ChatbotInput): Promise<ChatbotOutput> {
  return chatbotFlow(input);
}
```

---

#### **Passo 6: Conexão com o Frontend via Server Actions (`src/app/actions.ts`)**

Crie uma Server Action para ser a ponte segura entre a interface do usuário (Client Component) e a sua lógica de IA no servidor (Server Component).

```typescript
// src/app/actions.ts
'use server';

import {
  runChatbot,
  type ChatbotInput,
} from '@/ai/flows/chatbot-flow';

export async function getChatbotResponse(data: ChatbotInput) {
  try {
    const result = await runChatbot(data);
    return { success: result.response };
  } catch (e) {
    console.error(e);
    return { error: "Desculpe, ocorreu um erro ao processar sua solicitação." };
  }
}
```

---

#### **Passo 7: Criação da Interface de Chat no Frontend (`src/components/chat/chat-interface.tsx`)**

Finalmente, crie o componente React que o usuário final irá usar. Ele deve gerenciar o estado das mensagens e chamar a Server Action para obter as respostas da IA.

```typescript
// src/components/chat/chat-interface.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { getChatbotResponse } from '@/app/actions'; // Importa a Server Action

// ... (Resto dos imports e definição de tipos de mensagem) ...

export function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const form = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    const userMessage = { role: 'user', content: data.query };

    const history = [...messages];
    setMessages((prev) => [...prev, userMessage]);

    form.reset();

    // Chama a Server Action
    const response = await getChatbotResponse({ history, query: data.query });

    if (response.success) {
      const assistantMessage = { role: 'model', content: response.success };
      setMessages((prev) => [...prev, assistantMessage]);
    } else {
      // Trata o erro
      const errorMessage = { role: 'model', content: response.error };
      setMessages((prev) => [...prev, errorMessage]);
    }
    setLoading(false);
  };

  // ... (Resto do JSX para renderizar o formulário e as mensagens) ...
}
```
