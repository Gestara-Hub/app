# 21 — Painel admin: rodar e testar no ambiente local

Data: 2026-10-24. Status: Feito (fases 0 a 8).
Código: `apps/admin`, `apps/supabase/migrations/20261024000050_platform_schema.sql`.
Testes: `apps/admin/src/**/*.test.ts` (rápidos) e `*.db.test.ts` (Supabase local).

> O desenho está em [technical/26](../technical/26-painel-admin-gestarahub.md). Este guia é o passo a passo para subir e conferir.

## 1. Subir

```bash
pnpm setup:local        # Supabase local no ar e migrações (inclui o schema `platform`)
pnpm admin:setup        # papel do painel no banco e apps/admin/.env.local (sem imprimir segredos)
pnpm admin:create-admin -- --email voce@exemplo.com --name "Seu Nome"   # pede a senha (12+), sem mostrar
pnpm dev:admin          # http://localhost:3201
```

- O painel usa a porta **3001** (o app dos clientes segue na 3000) e cookies com nome próprio (`gestara-admin`), então os dois podem ficar abertos juntos.
- Outros papéis: `--role platform_support | platform_finance | platform_viewer`.
- Para recomeçar do zero: `pnpm setup:local:reset` e repita os passos acima.

## 2. Roteiro de teste manual (fase 0)

1. **Sem login:** abra `http://localhost:3201/audit`. Deve ir para `/login` (guardando o destino).
2. **Senha errada:** mensagem "E-mail ou senha incorretos." Na sexta tentativa no mesmo minuto: "Muitas tentativas...".
3. **Entrar:** e-mail e senha certos levam ao segundo fator.
4. **Primeira vez:** aparece o QR. Escaneie com um aplicativo autenticador (Google Authenticator, 1Password...), digite o código e confirme. Entra no painel (se veio de `/audit`, volta para lá).
5. **Início:** mostra seu papel, "Verificação em duas etapas feita", até que horas vale (8 horas) e "N espaços cadastrados" (prova a conexão com os dados).
6. **Auditoria:** deve ter "Configurou o aplicativo autenticador" e "Entrou no painel", com data, nome e origem (IP). Tente a senha errada de novo e veja "Tentativa de entrada com senha errada".
7. **Equipe:** você aparece com o papel e o último acesso.
8. **Sair** (menu do usuário) e entrar de novo: agora pede só o código do aplicativo.
9. **Isolamento (o ponto principal):**
   - Entre em `http://localhost:3201/login` com o e-mail e a senha de um usuário de espaço (por exemplo, o da demonstração). Deve dar "E-mail ou senha incorretos." e nada fica aberto. A tentativa aparece em Auditoria como "Entrada recusada (conta sem acesso)".
   - Em `http://localhost:3200/login` (app dos clientes), entre com o seu e-mail de administrador. Também deve dar "E-mail ou senha incorretos.".
10. **Papéis:** crie uma pessoa com `--role platform_support` e entre com ela: o menu mostra só Início (sem Equipe nem Auditoria); `/audit` direto volta ao início com o aviso "Seu papel não tem acesso a essa tela."
11. **Tema e mobile:** troque entre claro, escuro e do aparelho; abra a janela estreita e veja o menu lateral virar painel.

## 2B. Roteiro de teste manual (fases 1 a 8)

Prepare: `pnpm setup:local && pnpm admin:setup`, crie um administrador proprietário e um de suporte (`admin:create-admin`), e suba os dois apps (`pnpm dev` e `pnpm dev:admin`). Para o assistente responder, ponha `ANTHROPIC_API_KEY` em `apps/web/.env.local`; sem ela a conversa vai direto para a equipe. Sem credenciais AWS SES (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) os e-mails só aparecem no log do servidor.

1. **Fale com a gente (web, porta 3000).** Entre numa conta real (não a demonstração). Menu do usuário, "Fale com a gente". Pergunte algo do sistema: o assistente responde com base nos artigos. Peça "quero falar com uma pessoa" ou descreva um erro: a conversa vai para a equipe. Tente colar um CPF na mensagem: no painel ele aparece mascarado.
2. **Suporte (painel).** Em Suporte aparece a conversa (número ao lado do menu). Responda: o cliente vê a resposta no app, com a bolinha de não lido. Teste nota interna, resposta pronta (Respostas prontas), marcar urgente, encerrar e reabrir.
3. **Espaços.** Busque o espaço, filtre por plano e situação, abra a ficha e navegue pelas abas. Exporte a lista (CSV).
4. **Planos.** Na ficha, aba Assinatura, dê uma cortesia (precisa de papel proprietário ou financeiro). No web, em Planos, o dono vê a cortesia e o fim. Encerre a cortesia. Teste "mais dias para pagar" e "voltar ao Grátis" num espaço com plano pago atrasado.
5. **Saúde.** Gere um erro no web (por exemplo, ação inválida) e procure pelo código na tela Saúde; marque como erro conhecido.
6. **Comunicados.** Em Comunicados, publique um aviso "Por plano: Grátis". Use "Ver quantos recebem". No web, o aviso aparece no topo; dispense. Publique um urgente: não dá para dispensar. Arquive.
7. **Equipe (proprietário).** Convide uma pessoa (sem e-mail configurado, copie o link que aparece). Abra o link numa janela anônima, crie a senha, configure o aplicativo autenticador. Tente desativar a si mesmo ou o único proprietário: deve recusar. Mude o papel, reinicie o 2FA, desative e reative.
8. **LGPD (proprietário).** Em LGPD, registre um pedido e conclua (exige descrever o que foi feito). Na ficha do espaço, aba Dados e LGPD: baixe o arquivo (confira que não há senha nem chave) e inative o espaço; no web, quem estava logado cai no login e não consegue entrar. Reative.
9. **Visão de suporte (suporte ou proprietário).** Na ficha, aba Suporte e notas, "Abrir visão de suporte" com motivo. Confira que não há nomes de alunos. No web, na Auditoria do espaço, aparece "Suporte do GestaraHub abriu uma visão de suporte". Encerre.
10. **Receita e Início.** Em Receita, confira assinantes e receita mensal (cortesia não conta). O Início mostra os contadores de atenção.
11. **2FA de usuário de espaço e códigos de recuperação.** No web, em Segurança (menu do usuário), ligue o código por e-mail: aparecem 8 códigos de recuperação (copie ou baixe). Saia e entre: na tela do código, "Perdi o acesso ao código" aceita um deles (uma vez). Em Segurança, "Gerar novos códigos" pede um código atual. No painel (proprietário), abra o espaço, aba Dados e LGPD, escolha a pessoa em "Reiniciar a verificação em duas etapas" e confirme: no web ela entra só com a senha e a Auditoria do espaço mostra o aviso.
12. **Papéis.** Entre como suporte: não vê Equipe, Auditoria, LGPD, Receita nem Planos. Como financeiro: vê Planos e Receita, não vê Suporte.

## 3. Testes automáticos

```bash
pnpm --filter @gestarahub/admin test       # rápidos (~1 s): tempo de sessão, papéis, destino do login, configuração
pnpm --filter @gestarahub/admin test:db    # contra o Supabase local (~6 s): isolamento do banco e as actions de entrada de verdade
pnpm --filter @gestarahub/admin lint && pnpm --filter @gestarahub/admin typecheck
pnpm --filter @gestarahub/web test         # inclui a recusa do administrador no app dos clientes
```

Os testes de banco criam e apagam as próprias contas e espaços; a auditoria de teste é removida por uma função de teste (o gatilho que protege a auditoria volta a ligar na mesma transação).

## 3B. Testes de tela e ponta a ponta (navegador)

```bash
pnpm --filter @gestarahub/admin e2e                       # todos (~1 min), servidor próprio na porta 3101
pnpm --filter @gestarahub/admin e2e -- e2e/telas.spec.ts  # só a passada de telas (desktop e celular)
```

Só quando pedido (usa o Supabase local e sobe um `next dev` próprio). As capturas ficam em `apps/admin/test-results/telas`. Detalhes na seção 19 do [doc 26](../technical/26-painel-admin-gestarahub.md).

## 4. Problemas comuns

- **Perdi o aplicativo autenticador (2FA):** outro proprietário usa "Reiniciar 2FA" na tela Equipe. Se você é o único proprietário, rode `pnpm admin:reset-mfa -- --email voce@exemplo.com` (precisa de acesso à infraestrutura, pede confirmação e registra na auditoria). No próximo login o painel pede o cadastro de um novo QR. Guarde a chave que aparece abaixo do QR num gerenciador de senhas: com ela se recadastra o mesmo código em outro aparelho.
- **"Configuração do painel incompleta"**: falta `apps/admin/.env.local`; rode `pnpm admin:setup`.
- **Falha de conexão com o banco**: o Supabase local não está no ar (`pnpm setup:local`).
- **O app dos clientes (porta 3000) e o painel dividem o mesmo Supabase local**: é de propósito. As contas de administrador existem só na autenticação com o marcador de plataforma e a linha em `platform.admins`.
