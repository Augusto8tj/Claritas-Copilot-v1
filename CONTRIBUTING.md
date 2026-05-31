# Como Contribuir

Obrigado pelo seu interesse em contribuir para o projeto Robô de Trading com IA! Sua ajuda é muito bem-vinda para tornar este projeto ainda melhor.

## Diretrizes Gerais

1.  **Fork o Projeto:** Crie um fork deste repositório para sua conta GitHub.
2.  **Clone o Repositório:** Clone seu fork localmente:
    \`\`\`bash
    git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
    cd seu-repositorio
    \`\`\`
    *Substitua `SEU_USUARIO` e `SEU_REPOSITORIO` pelos seus dados.*
3.  **Crie uma Branch:** Crie uma nova branch para suas alterações:
    \`\`\`bash
    git checkout -b feature/nome-da-sua-feature
    # ou
    git checkout -b fix/nome-do-bug
    \`\`\`
4.  **Faça suas Alterações:** Implemente suas melhorias ou correções. Siga os padrões de código existentes no projeto (TypeScript, Prettier, ESLint).
5.  **Teste suas Alterações:** Certifique-se de que suas alterações não introduzam novos bugs e que os testes existentes (se houver) passem. Se aplicável, adicione novos testes.
6.  **Commite suas Alterações:** Faça commits claros e descritivos:
    \`\`\`bash
    git commit -m "feat: Adiciona funcionalidade X"
    # ou
    git commit -m "fix: Corrige bug Y no módulo Z"
    \`\`\`
7.  **Envie para o seu Fork:** Envie suas alterações para o seu fork no GitHub:
    \`\`\`bash
    git push origin feature/nome-da-sua-feature
    \`\`\`
8.  **Abra um Pull Request (PR):** No GitHub, abra um Pull Request do seu fork para a branch principal (`main` ou `master`) do repositório original. Descreva claramente as alterações e os motivos.

## Padrões de Código

*   **Linguagem:** TypeScript
*   **Formatação:** O projeto utiliza Prettier para formatação automática. Execute `npm run format` (ou `yarn format`) para formatar seu código antes de commitar.
*   **Linting:** O ESLint é usado para garantir a qualidade do código. Execute `npm run lint` (ou `yarn lint`) para verificar possíveis problemas.
*   **Commit Messages:** Utilize o padrão Conventional Commits para as mensagens de commit (ex: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`).

## Tipos de Contribuição

*   **Correção de Bugs:** Reportar ou corrigir bugs encontrados.
*   **Novas Funcionalidades:** Adicionar novas features que se alinhem com o objetivo do projeto.
*   **Melhorias de Documentação:** Ajudar a manter a documentação clara e atualizada.
*   **Otimização de Performance:** Contribuir para tornar o código mais eficiente.
*   **Testes:** Adicionar ou melhorar a cobertura de testes.

Se tiver alguma dúvida ou precisar de ajuda, não hesite em abrir uma issue.

Obrigado novamente!
