# Claritas Copilot - Registo de Alterações

Este documento regista a jornada de desenvolvimento e as principais funcionalidades implementadas no Claritas Copilot.

---

### v1.0.0 (Atual) - A Ascensão da IA: Autonomia e Persistência

**Funcionalidades Principais:**
- **Autonomia Total da Mesa:** A Mesa Operacional agora ajusta dinamicamente não só o **limiar de consenso**, mas também o **valor da aposta (`stake`)** e a **duração do contrato** a cada tick. A IA analisa a volatilidade (ATR, Z-Score) e a força da tendência (ADX) para tomar decisões de risco em tempo real.
- **Memória Persistente com Firebase:** A Arena Virtual agora é "imortal". O desempenho de cada um dos 22 robôs (vitórias, derrotas, P&L) é guardado de forma segura no **Firestore**, associado à sua conta de utilizador. O progresso já não se perde ao fechar o navegador.
- **Hall da Fama Integrado:** O Hall da Fama foi movido da sua página isolada para um separador dedicado diretamente dentro da página **Deriv Trader**, centralizando todo o ecossistema de trading num único local. Ele busca os dados do Firebase, mostrando um placar de líderes persistente.
- **Consenso Relativo e Inteligente:** O limiar de consenso deixou de ser um número absoluto. Agora é calculado como uma **percentagem do potencial de voto máximo** disponível a cada momento, tornando-o verdadeiramente adaptativo à quantidade de robôs que têm uma opinião formada (`RISE` ou `FALL`).
- **Estratégias Locais e Fim da Dependência da IA:** O conselho de 22 robôs analistas já não é gerado por uma chamada de IA. As suas estratégias estão agora definidas localmente no ficheiro `src/services/council-strategies.ts`, tornando a inicialização da Mesa Operacional instantânea, fiável e consistente.

**Correções Críticas:**
- Resolvido um erro crucial (`TypeError: Cannot read properties of null`) que impedia a execução de trades automáticas devido à falta de verificação dos indicadores.
- Corrigida a lógica de votação do robô de Bandas de Bollinger, que estava inoperante e impedia a atividade na Arena.
- Garantido que os ajustes dinâmicos de `stake` e `duration` respeitam os limites mínimos da corretora ($0.35 e 1-10 ticks) e que os valores corretos são usados na execução da ordem.
- Corrigido um erro que tentava executar trades antes de a conexão com a API da corretora estar totalmente estabelecida.

---

### v0.5.0 - A Arena Virtual e Meritocracia

**Funcionalidades Principais:**
- **Criação da "Arena Virtual":** Implementação de um sistema de "paper trading" competitivo em segundo plano. O sistema rastreia o desempenho individual de cada um dos 22 robôs analistas.
- **Memória de Desempenho:** Utilização do `localStorage` para guardar as vitórias, derrotas e o P&L (Lucro/Prejuízo) de cada robô durante a sessão de trading.
- **Página "Mesa de Operações" (`/trading-desk`):** Criação de um novo ecrã que funciona como um *leaderboard*, exibindo o ranking de desempenho de todos os analistas, incluindo taxa de acerto e resultado financeiro.
- **Implementação da "Meritocracia":** Adição de um modo de operação onde os robôs com melhor desempenho histórico têm os seus votos ponderados com mais força, tornando o sistema auto-otimizável e adaptativo.
- **Navegação Atualizada:** Adicionado um link no menu lateral para a nova página "Mesa de Operações".

---

### v0.4.0 - Inteligência de Gestão e Análise de Elite

**Funcionalidades Principais:**
- **Gestão de Risco e Tempo Dinâmicos:** A "Direção de Risco" (`supervisionCommitteeCheck`) foi potenciada para não só aprovar ou vetar, mas também para **ajustar dinamicamente o valor da aposta (`stake`) e a duração do contrato**, com base na confiança do consenso e em fatores de mercado como volatilidade (ATR) e força da tendência (ADX).
- **"Gestor de Turno" Inteligente:** A persona `committeeOfSpecialists` foi evoluída para analisar a condição de mercado em tempo real (ex: "Tendência de Baixa com Exaustão") e exibir essa leitura na interface.
- **Lógica de Voto de Alta Frequência:** Implementação dos "Gatilhos de Disparo" para cada um dos 22 analistas, permitindo reações instantâneas a micro-movimentos em horizontes de tempo curtos (5 ticks).
- **Transparência Total da Mesa:** A interface foi atualizada para exibir em tempo real a atuação de todas as personas: o comité tático ativo, a decisão da supervisão de risco e a soma atual do consenso de votos.

**Correções:**
- **Reparação do Motor de Cálculo:** Corrigido o cálculo do indicador `RVI` e do `BBW` (Largura das Bandas de Bollinger), completando o arsenal de 22 indicadores no painel.

---

### v0.3.0 - O Conselho de 22 Analistas de IA

**Funcionalidades Principais:**
- **Criação do `strategy-council-flow`:** Desenvolvimento do fluxo de IA mestre, responsável por gerar um conselho de 22 robôs analistas, cada um com uma estratégia e parâmetros específicos.
- **Calibração Dinâmica:** O conselho passou a ser "consciente do tempo". A IA ajusta os parâmetros de todos os analistas com base no horizonte de tempo selecionado (de Ticks a Diário).
- **Motor de Cálculo Abrangente:** Criação do `DerivFinanceLib.ts` e `indicator-service.ts`, um motor robusto para calcular todos os 22 indicadores técnicos necessários para alimentar o conselho.
- **Lógica de Votação:** Implementação da lógica base para que cada analista possa emitir um voto de `RISE`, `FALL`, ou `HOLD`.

**Correções Críticas:**
- Resolvido um bug onde os robôs perdiam o acesso aos dados do motor de cálculo ("perda de visão").
- Corrigido um erro de `module not found` que impedia a construção do conselho.

---

### v0.2.0 - Introdução à Mesa Operacional (Deriv Trader)

**Funcionalidades Principais:**
- **Integração com a API da Deriv:** Estabelecimento da conexão WebSocket para receber dados de mercado em tempo real e executar operações.
- **Gráfico de Trading Avançado:** Implementação de um gráfico renderizado em SVG, estável, responsivo, com suporte para múltiplos tipos (Linha/Velas), indicadores sobrepostos e ferramentas de zoom.
- **Copiloto de Trade:** Primeira versão do assistente de IA para negociação, capaz de analisar o desempenho e sugerir operações.
- **Estrutura de Hooks:** Criação do `useDerivApi` para centralizar a comunicação com a API e do `useRobotCouncil` como o "cérebro" da operação.

---

### v0.1.0 - Fundação e Finanças Pessoais

**Funcionalidades Iniciais:**
- **Setup do Projeto:** Estruturação inicial do projeto em Next.js com TypeScript e ShadCN UI.
- **Módulos de Finanças Pessoais:** Implementação do Painel Principal, Análise de Despesas, Orçamento Mensal e Metas Financeiras.
- **Autenticação:** Sistema de login e registo de utilizadores com Firebase.
- **Chatbot com IA (Claritas):** Integração de um chatbot Genkit para insights e interações financeiras.
- **Página de Ajuda e Configurações:** Criação das páginas de suporte e personalização da aplicação.
