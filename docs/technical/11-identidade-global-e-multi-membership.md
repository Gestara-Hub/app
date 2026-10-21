# ADR 11 — Identidade Global e Multi-Membership (Um e-mail, múltiplos espaços)

## Decisão

O GestaraHub adota o modelo de **Identidade Global com Vínculos Multi-Tenant** (padrão Slack / Notion / GitHub):
1. **Identidade Global (Quem o usuário é)**: Gerenciada pelo Supabase Auth (`auth.users`). O e-mail (ex.: `carlos@gmail.com`) possui uma única conta global e uma única senha.
2. **Vínculos / Memberships (Onde o usuário atua e qual seu perfil)**: Registrados em `public.users` (para proprietários, gerentes, atendentes e professores) e, para alunos e responsáveis, em `student_access` (um vínculo por ficha, `self` ou `guardian`; a ficha em `public.clients` é o dado do aluno no espaço, não autentica ninguém). Decidido em 21/10/2026 no [ADR 13](13-acesso-de-alunos-e-responsaveis.md), que substitui a redação anterior ("em `public.clients` para alunos").
3. **Isolamento e RLS**: Cada organização continua 100% isolada via Row-Level Security no PostgreSQL. Uma academia nunca tem acesso aos dados, histórico ou pagamentos de um aluno/professor em outra academia.
4. **Momento de Ativação na Interface**:
   - O banco de dados já foi modelado sem restrição `UNIQUE(email)` por tenant, garantindo total compatibilidade futura sem refatorações destrutivas.
   - A experiência de seleção de espaço (**Workspace Selector** no login e **Tenant Switcher** no cabeçalho) será implementada no momento da construção do **PWA para Alunos e Professores** (ver [ADR 10](10-monolito-frontend-pwa.md)) e no fluxo de convites de equipe.

## Contexto

Em negócios recorrentes e estúdios:
- **Alunos**: Uma mesma pessoa (ou responsável) pode fazer judô na academia A e aula de pintura na escola B, ou ter filhos matriculados em espaços diferentes. Exigir e-mails diferentes para cada espaço geraria enorme atrito e abandono.
- **Professores**: Instrutores e professores frequentemente lecionam em mais de um estabelecimento parceiro e precisam acessar suas turmas e chamadas sem deslogar e logar com e-mails distintos.
- **Proprietários**: Empreendedores com mais de um negócio (ou filiais isoladas) desejam gerenciar os espaços com a mesma credencial de acesso.

## Escopo

- Modelagem multi-membership no Supabase Auth + Postgres.
- Regra de produto para login com múltiplas organizações:
  - Se o usuário possui vínculo com apenas 1 organização: entra direto (comportamento atual).
  - Se possui vínculo com 2 ou mais organizações: exibe seletor de espaço ("Em qual negócio deseja entrar agora?").
- RLS e isolamento rígido por `organization_id` mantido em todas as consultas.

## Alternativas Rejeitadas

- **E-mail único global com 1 organização obrigatória**: Rejeitado. Forçaria alunos e professores a criarem e-mails alternativos (ex.: `carlos+judo@gmail.com`), prejudicando a experiência mobile do PWA.
- **Bancos de dados separados por tenant (Database-per-tenant)**: Rejeitado. Custo e complexidade operacional excessivos para o estágio atual do produto; o isolamento lógico via PostgreSQL RLS com tenant discriminator (`organization_id`) atende plenamente à segurança e LGPD.
