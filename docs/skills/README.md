# Skills do Projeto

As skills do GestaraHub vivem em [`.claude/skills/`](../../.claude/skills/) (um diretorio por skill, com o `SKILL.md`). Elas transformam decisoes recorrentes do projeto em instrucoes reutilizaveis para desenvolvimento, revisao e documentacao. Este diretorio so aponta para elas.

## Skills disponiveis

| Skill | Para que serve |
| --- | --- |
| [`adr`](../../.claude/skills/adr/SKILL.md) | Registrar uma decisao de arquitetura ou de produto nos docs do jeito padrao e corrigir o drift de documentacao que ela cria. |
| [`architect`](../../.claude/skills/architect/SKILL.md) | Decidir e revisar arquitetura em `apps/web`: onde o codigo vive, fronteiras de modulo, extracao de pacotes, RSC x client, prontidao para MFE, checklist de revisao. |
| [`contract`](../../.claude/skills/contract/SKILL.md) | Criar ou evoluir um contrato em `@gestarahub/contracts` (entidades, read-models, Create/Update, enums, codigos de erro) mantendo service mock e seed em sincronia. |
| [`smoke-web`](../../.claude/skills/smoke-web/SKILL.md) | Subir e dirigir o `apps/web` para um smoke test em runtime (cookie de sessao forjado, puppeteer-core sobre o Chrome do sistema, injecao de dados no localStorage). |
| [`web-data`](../../.claude/skills/web-data/SKILL.md) | Escrever ou evoluir a camada de services mock: `simulateRead`/`simulateWrite`, read-models, codigos de `ApiError` com mensagens em PT, `queryKeys` e hooks do TanStack Query. |
| [`web-feature`](../../.claude/skills/web-feature/SKILL.md) | Criar ou estender um feature slice: pasta da feature, service, contratos, hooks, rota, nav e guarda de RBAC, respeitando as fronteiras. |
| [`web-form`](../../.claude/skills/web-form/SKILL.md) | Construir formularios com React Hook Form + Zod, os campos compartilhados, mapeamento de erro da API para campo e o padrao de confirmacao de regra mole. |
