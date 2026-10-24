# 08 — Backend no Supabase

Data: 2026-10-14.

> **Status:** decidido em 14/10/2026 e atualizado em 19/10/2026. Substitui a direção "funções serverless da Vercel" e o NestJS registrados antes em [00-decisoes-tecnicas.md](00-decisoes-tecnicas.md).
> ⚠️ **Atualização (19/10/2026):** A ideia de aplicativos separados em React Native para aluno e professor foi substituída pelo **Monólito Frontend em Next.js com PWA** ([10-monolito-frontend-pwa.md](10-monolito-frontend-pwa.md)). Toda a interface (gestor, aluno e professor) fica unificada em `apps/web`.
> Passagem do mock para o servidor: [06-passagem-backend.md](../archive/technical-06-passagem-backend.md).

## Contexto

- O produto é gratuito para os espaços nos primeiros meses, e a infraestrutura sai do bolso do fundador. O critério principal é o **menor custo mensal**, pagando só quando o uso real pedir.
- Vão existir **apps em React Native para aluno e professor**, além da web. As regras de acesso precisam valer igual nos três.
- O plano gratuito da Vercel (Hobby) é **só para uso pessoal e não comercial**, e as tarefas agendadas dele rodam no máximo uma vez por dia, com até 59 minutos de atraso. Usar a Vercel para o backend exigiria o plano Pro (US$ 20 por mês por desenvolvedor).

## Decisão

Todo o backend fica no **Supabase**:

| Parte | Como | Observação |
|---|---|---|
| Banco | Postgres do Supabase | Relacional, com regras de acesso por linha (RLS) isolando cada espaço. |
| Login | Supabase Auth | Mesmo login na web e nos apps; substitui o cookie simulado `gestarahub_session`. |
| Leitura e gravação simples | Web e apps falam direto com o Supabase (`supabase-js`), protegidos por RLS | Sem servidor próprio para listar e cadastrar. |
| Regras de negócio | **Edge Functions** (serverless) com **Hono**, usando `packages/core` e `packages/contracts` | Gerar mensalidades, fechar o mês do professor, graduar, cancelar com motivo etc. Mesmas mensagens e formato de erro (`ApiError`) do mock. |
| Tarefas agendadas | **Supabase Cron** (`pg_cron`) chamando funções ou SQL | Mensalidades do dia, recorrências, parabéns automático (ver doc 06, seção 2.1). Cada execução trata um espaço por vez, para caber no limite de tempo. |
| Comprovantes | **Supabase Storage**, bucket privado, link temporário | Imagem comprimida no app antes do envio (web e celular); PDF com limite de tamanho. Acesso pela mesma regra de permissão (`finance:view`). |

**Frontend web:** continua na Vercel por enquanto. Antes do primeiro cliente real, testar a Cloudflare (adaptador OpenNext) com o login do Supabase já trocado; se o Next 16 não rodar inteiro lá, usar a Vercel Pro. O Supabase não hospeda frontend.

## Tudo serverless: nada exige servidor sempre ligado

Levantamento de 14/10/2026, funcionalidade por funcionalidade (inclui as que ainda vão existir):

| Funcionalidade | Como fica |
|---|---|
| Cadastros, listas, chamada | `supabase-js` direto com RLS. |
| Regras de negócio | Edge Functions com Hono. |
| Tarefas agendadas | Supabase Cron chamando funções; lote grande vira fila (Supabase Queues), um espaço por vez. |
| WhatsApp oficial: envio | Chamada HTTP da função para a API da Meta (ou do parceiro). |
| WhatsApp oficial: status e respostas | Aviso (webhook) da Meta recebido por uma função, com conferência da assinatura. |
| WhatsApp oficial: conexão de cada espaço | Conexão guiada da Meta no navegador; a função troca o código pelo acesso e guarda o token criptografado (Supabase Vault). |
| Pagamento online dos alunos (Pix, link, Pix Automático, repasse) | Função pede a cobrança ao provedor; a baixa chega por webhook; a recorrência fica com o provedor. |
| Assinatura do plano da plataforma (Pro, Scale) | Provedor cobra todo mês e avisa por webhook; a função libera ou bloqueia o plano. |
| Nota fiscal | Provedor ou emissor, via HTTP. |
| Atualização ao vivo | Supabase Realtime. |
| Notificações nos apps | Função chama o serviço de push da Expo. |
| E-mail (recuperar senha, convite) | Supabase Auth, com serviço de e-mail próprio ligado (o envio padrão do grátis tem limite baixo). |
| Relatórios | CSV na função ou no navegador; PDF no navegador ou com biblioteca leve. |

**O que exigiria servidor e não temos:** sessão do WhatsApp por QR code (descartada em 13/10/2026), tarefas acima de 400 segundos, processamento pesado (vídeo, PDF com navegador embutido) e conexão permanente com terceiros.

### Avisos externos (webhooks): regras obrigatórias

- **Idempotência:** o mesmo aviso recebido duas vezes não paga duas vezes nem duplica mensagem. Guardar o identificador do evento do provedor ou da Meta e ignorar repetidos.
- **Assinatura:** conferir a assinatura ou o token de cada aviso antes de gravar.
- **Responder rápido:** gravar o aviso e devolver sucesso; o que for demorado vai para a fila.
- **Conferência diária:** uma tarefa agendada consulta no provedor de pagamento e na Meta o status das cobranças e mensagens que ficaram sem aviso (aviso perdido ou função fora do ar).

## Limites conhecidos (a respeitar no desenho)

- Edge Functions: até 2 segundos de processamento por chamada (espera do banco não conta), 256 MB de memória, até 150 segundos por chamada no grátis e 400 no pago. Sem bibliotecas nativas de imagem.
- Plano grátis do Supabase: banco de 500 MB, 1 GB de arquivos, 500 mil chamadas de função por mês, **sem backup automático** e **pausa depois de 1 semana sem uso**. Dois projetos grátis: um de teste e um de produção.
- Pacote `@supabase/server` (adaptador de login para o Hono) em beta: fixar a versão.

## Custo por fase

| Fase | Como fica | Custo mensal |
|---|---|---|
| Desenvolvimento | Supabase grátis (teste e produção), frontend na Vercel grátis | US$ 0 |
| Piloto (primeiros espaços) | Supabase grátis com **cópia do banco toda noite** por tarefa no GitHub, guardada em armazenamento privado | US$ 0 a 5 |
| Uso real (dezenas de espaços ou primeiro cliente Pro) | Supabase Pro: backup diário, sem pausa, 100 GB de arquivos, 2 milhões de chamadas | US$ 25 a 30, mais o frontend |

Fora da infraestrutura: conta de desenvolvedor da Apple (US$ 99 por ano) e do Google Play (US$ 25, uma vez).

## A validar na primeira fatia (login, espaço e usuários)

- Importar `packages/core` e `packages/contracts` dentro das Edge Functions (Deno, com `npm:` e import map).
- Rotas do Hono prefixadas com o nome da função.
- Sessão do Supabase no Next (porteiro de rotas `proxy.ts`, `requirePermission`) e nos apps.
- Onde cada regra mora: RLS (quem vê o quê) e Edge Function (o que muda dado com regra de negócio). Regra que existe nos services do mock e nos testes de service vira Edge Function, não lógica na tela.

## Consequências

- O NestJS sai de cena. O Hono continua portátil: se o Supabase deixar de servir, as funções podem ir para outro lugar (Cloudflare Workers, por exemplo) sem reescrever as regras.
- Parte da segurança fica no banco (RLS). Toda tabela nova nasce com política de acesso por espaço e um teste dela.
- Os testes de service (`apps/web/src/services/__tests__`) são a especificação de cada fatia: a troca do mock pela API só fecha quando eles passam contra o comportamento novo.

## Fontes

- [Supabase: preços](https://supabase.com/pricing)
- [Supabase: Edge Functions](https://supabase.com/docs/guides/functions) e [limites](https://supabase.com/docs/guides/functions/limits)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Vercel: plano Hobby (uso não comercial)](https://vercel.com/docs/plans/hobby) e [tarefas agendadas](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Cloudflare Workers: preços](https://developers.cloudflare.com/workers/platform/pricing/)
