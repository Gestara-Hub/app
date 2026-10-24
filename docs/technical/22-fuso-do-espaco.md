# 22. Fuso do espaço

Data: 2026-10-23. Origem: achados 60 e 76 do teste geral (`qa/2026-10-23-teste-geral.md`).

## Problema

O servidor roda em UTC (Vercel) e o navegador roda no fuso do aparelho. Pagamento feito às 21h41 de 23/10 em Brasília aparecia como "pago em 24/10", e a baixa enviada ao Asaas saía com a data de 24/10, que o Asaas recusa ("não pode ser posterior a data atual"). O Brasil tem quatro fusos, sem horário de verão desde 2019. Por isso, fixar Brasília não basta.

## Decisão

Cada espaço tem um fuso. O "hoje", o "agora" e o dia de um horário gravado saem desse fuso, no servidor e no navegador.

| Fuso | Onde |
| --- | --- |
| `America/Noronha` (UTC−2) | Fernando de Noronha (só por escolha: o estado é PE) |
| `America/Sao_Paulo` (UTC−3) | Brasília e a maior parte do país (padrão) |
| `America/Manaus` (UTC−4) | AM, MT, MS, RO e RR |
| `America/Rio_Branco` (UTC−5) | Acre e oeste do Amazonas |

**De onde vem o fuso do espaço**, nesta ordem:
1. o escolhido em Configurações → Endereço → "Fuso horário" (`organization.settings.timeZone`);
2. o do estado do endereço da unidade;
3. Brasília.

## Como funciona

- **Núcleo** (`@gestarahub/core/date`):
  - `BRAZIL_TIME_ZONES`, `timeZoneForState` e `resolveSpaceTimeZone`;
  - `dateInSpace`, `timeInSpace` e `startOfDayInSpace`;
  - `todayISO`, `currentMonthISO` e `nowTime`, já no fuso do espaço;
  - quem diz o fuso "atual" é um provedor (`setSpaceTimeZoneProvider`), guardado no objeto global.
- **Servidor:**
  - `requireTenant` lê o fuso na mesma consulta do usuário (`ctx.timeZone`) e anota no escopo da requisição (`setErrorScope`, `lib/log/server-sink.ts`);
  - dentro do espaço carregado (`runInWorld`), o fuso vem do próprio espaço (`services/world/scope.ts`). Isso vale também para as rotas de documentos;
  - a rotina diária roda sem sessão e lê o fuso de cada espaço (`membershipBackend`, `financeBackend`).
- **Navegador:**
  - o layout do app resolve o fuso no servidor (`getSessionTimeZone`, na mesma leitura que confere o usuário) e o `SessionProvider` liga o provedor;
  - ao trocar o fuso ou o endereço em Configurações, a página recarrega o layout.
- **Página pública de pagamento** (`/p/<código>`): mostra a validade e a data do pagamento no fuso do espaço que cobra.
- **Asaas** (`lib/asaas/dates.ts`): o Asaas conta os dias no horário de Brasília.
  - As datas que chegam dele são dias de Brasília.
  - As que enviamos não podem passar do "hoje" dele.
  - A baixa manda o dia do espaço limitado ao hoje do Asaas (`notAfterAsaasToday`). Isso só faz diferença em Noronha, depois das 23h.
  - O vencimento nunca fica antes do hoje do Asaas.
- **Baixa simulada no sandbox** (achado 76): a baixa no parceiro vem antes de gravar no app. Se o Asaas recusar, a cobrança continua em aberto, com a mensagem "O parceiro de pagamentos recusou a baixa".

## Regra para código novo

- "Hoje" é `todayISO()` de `@gestarahub/core/date`. Nunca use `format(new Date(), "yyyy-MM-dd")` nem `toISOString().slice(0, 10)`.
- O dia de um horário gravado é `dateInSpace(iso)`. Nunca use `iso.slice(0, 10)`: isso dá o dia em UTC.
- Data enviada ao Asaas passa por `asaasToday` ou `notAfterAsaasToday`.

## Limites conhecidos

- **Página desenhada no servidor** (achado 81): o servidor desenha a tela antes do navegador ligar o fuso e usa Brasília. Num espaço de outro fuso, perto da meia-noite, o primeiro desenho pode mostrar o dia de Brasília até o navegador assumir. Registrado em `pendencias.md`.
- `process.env.TZ` continua em Brasília no servidor, como reserva para o que ainda formata data pelo relógio local (exibição de dias sem hora, que não muda com o fuso).
- **Multiunidade:** o fuso é do espaço, não da unidade. Unidades em fusos diferentes ficam para quando houver multiunidade (plano Expansão).

## Testes

- `packages/core/test/date.test.ts`: os quatro fusos, o estado, o início do dia e o relógio simulado.
- `apps/web/src/services/__tests__/space-time-zone.test.ts`: o "hoje" dos serviços, o escopo da requisição e o limite do Asaas em Noronha.
- `apps/web/src/services/onlinePayments/__tests__/simulateOnlinePaid.db.test.ts`: a recusa do Asaas deixa a cobrança em aberto, e a baixa vai com o dia do espaço.
