# Contexto para continuar o trabalho (18/10/2026)

Para o agente (Antigravity ou outro) que assume a partir daqui. Leia este arquivo antes de tudo. Depois leia `CLAUDE.md` na raiz: é a versão mais completa das regras do projeto (o `AGENTS.md` é um resumo).

## 1. Onde o projeto está

- **Repositório:** `main` com 55 commits à frente do `origin` em 18/10 (o último é o destes roteiros), **sem push**. O push é sempre do usuário; confira com `git status -sb`.
- **Rodada de testes de 18/10/2026:** 178 achados, todos corrigidos e commitados (Prioridades 1, 2 e 3 e os sem prioridade). Só o **ACE-43** (cookie de sessão sem assinatura) fica para o backend. O relatório e o status de cada item estão em [`../2026-10-18-rodada-de-testes.md`](../2026-10-18-rodada-de-testes.md).
- **Testes automáticos:** Vitest 911 e core 210 passam.
  - O **e2e (Playwright) não rodou** desde as correções.
  - O layout da Prioridade 3 **não foi visto no navegador**.
  - Isso ficou para depois (seção 6).
- **Landing:** os prints da seção "Por dentro" foram refeitos em 18/10. Script: `apps/web/scripts/landing-screenshots/capture.spec.ts`.

## 2. A tarefa agora

O usuário vai rodar à mão os 5 roteiros desta pasta e, ao fim de cada um, mandar o JSON do espaço. O JSON sai pelo comando do [README](README.md).

Os roteiros são **completos** (18/10): juntos, passam por todos os fluxos do modelo de turmas. A tabela "Onde está cada fluxo" do README diz qual parte cobre o quê.

| Roteiro | Área | Foco |
|---|---|---|
| [01](01-lutas.md) | Lutas | configuração, equipe e perfis, turmas, matrícula, chamada, avulsa, graduação, troca de instrutor, auditoria |
| [02](02-pilates-e-yoga.md) | Pilates e yoga | regras de cobrança, planos, descontos e bolsa, Cobranças, Financeiro, Plano Pro (pagamento online) |
| [03](03-idiomas-e-reforco.md) | Idiomas e reforço | landing e cadastro, níveis, notas, ficha do aluno, Comunicação, relatórios, configurações |
| [04](04-gastronomia.md) | Gastronomia | curso com parcelas, cancelamento, rematrícula, lista de espera, certificado |
| [05](05-outra-area-pacote.md) | Outra área | área própria, pacote de aulas (venda, uso, renovação), "Pagar com pacote", repasse |

O usuário pode mandar o JSON no fim de uma parte, não só do roteiro inteiro. Confira só o que aquela parte já fez.

Alguns "Esperado" dos roteiros foram escritos a partir do código, sem rodar a tela. Se a tela mostrar outro texto com o mesmo sentido, corrija o roteiro, não o código.

**Para cada JSON recebido:**

1. Confira a seção "O que vou conferir no JSON" do roteiro, item por item.
2. Responda ao usuário em português:
   - o que bateu;
   - o que não bateu, com o campo e o valor encontrado;
   - para cada diferença, se é bug, digitação diferente do roteiro ou expectativa errada do roteiro.
3. **Bug:**
   - ache a causa no código;
   - corrija com um teste de serviço em `apps/web/src/services/__tests__/`;
   - rode as checagens da seção 5;
   - diga o que mudou.
   - Não commite sem o usuário pedir.
4. **Expectativa errada:** corrija o roteiro nesta pasta e avise.

As datas do roteiro são relativas a "hoje". Use a data que o usuário informar ou a do `markedAt` e do `createdAt` mais recentes.

## 3. Como ler o JSON (formato do mock)

- **Valores em centavos:** `amountCents: 18000` = R$ 180,00.
- **Datas:**
  - `YYYY-MM-DD` para data e `HH:MM` para horário;
  - timestamps (`createdAt`, `paidAt`, `markedAt`) em ISO UTC: depois das 21h no Brasil, já caem no dia seguinte.
- **Aula:** `sessionId = "<classGroupId>~<data>~<início>"`.
- **`charges`:**
  - `kind`: `membership`, `course`, `package`, `extra` ou `dropin`;
  - **atraso não é gravado**: cobrança em aberto com `dueDate` passado fica `status: "pending"` no JSON e aparece "Atrasado" na tela (`billingService`, função que deriva o status);
  - cancelada pelo sistema numa troca: `status: "canceled"`, `canceledBy: "system"`, `replaced: true`;
  - paga: `paidAt`, `method` (`pix`, `cash`, `card`, ...) e `paidVia`.
- **`clients[].discount`:** `{ type: "percentage" | "fixed", value, scholarship? }`. Bolsa é desconto com `scholarship`.
- **`clients[].progressions[modalityId]`:** campos `levelId`, `levelName`, `subLevel` (grau ou etapa), `promotedAt`, `evaluations[]` e `promotionHistory[]`. Nas `evaluations[]` (registros de aula), `tone` é `positive`, `attention` ou `general`.
- **Pacotes:**
  - `lessonPackages` é o catálogo. `classGroupIds` vazio vale em todas as turmas de pacote e de mensalidade. `absenceConsumes` diz se a falta gasta aula.
  - `studentPackages` é a venda ao aluno: `usages[]` (`sessionId`, `reason`), `lessonsUsed`, `purchasedAt` e `expiresAt`.
- **`assessments[]`:** `grades[]` com `status` (`graded`, `absent` ou `none`) e `value`.
- **`organization.settings`:**
  - `billingTiming`: `prepaid` ou `postpaid`;
  - `midMonthStrategy`: `prorated` ou `full_cycle`;
  - também `defaultDueDay`, `onboardingCompleted` e `modalitiesReviewed`.
  - Outra área usa `classSegment: "custom"` e `customSegment*`.
- **`auditLog[].summary`:** "<autor> <o que fez>".

## 4. Regras de produto já decididas (não reabrir)

- **Pacote:** vale só nas turmas escolhidas no catálogo (nenhuma = todas as de pacote e de mensalidade), nunca em turma sem cobrança nem em curso. Só paga aula a partir do dia da compra, e o pacote que vence primeiro paga. A falta gasta se o pacote mandar; a justificada não.
- **Aula já paga com pacote** continua no pacote se o aluno passar a pagar com mensalidade.
- **Professor:** vê e age só nas turmas em que é o titular e nas aulas em que substitui.
- **Inativar o aluno** encerra as matrículas, com aviso antes.
- **A atendente pode mandar mensagens.**
- **Telefone com país:** guardado em E.164 (`+5511...`), Brasil por padrão, e no Brasil precisa do DDD. O telefone é obrigatório no cadastro do aluno.
- **Vencimento:** até o dia 31; os dias 29 a 31 caem no último dia dos meses mais curtos.
- **Prazos:** mudar desconto, bolsa ou valor do plano vale a partir do próximo período.
- **Avaliação e graduação:** nenhuma das duas aceita data futura.
- **Área sem trilha** (pilates, funcional) não pede revisão de níveis e metas.

## 5. Regras de trabalho

- Código, nomes e chaves em **inglês**; tudo o que aparece na tela em **português do Brasil**. Sem travessão no texto e sem reticências cortando nome ou valor (doc `docs/frontend/07-padroes-telas-e-ux.md`).
- **Checagens depois de mudar código:**

  ```bash
  pnpm --filter @gestarahub/web typecheck
  pnpm --filter @gestarahub/web lint
  cd apps/web && npx vitest run
  cd packages/core && pnpm test   # so se mexer em packages/core
  ```

- **Não rode e2e nem Playwright** sem o usuário pedir.
- **Não commite nem dê push** sem o usuário pedir. Quando pedir commit, separe em lotes por assunto, sem push.
- Regras de negócio: `docs/product/11-modelo-3-turmas.md` (turmas), `docs/product/15-regras-de-cobranca.md` (cobrança), `docs/product/06-perfis-permissoes.md` (acessos).
- Fale com o usuário em português, direto.

## 6. Depois dos roteiros

1. **Rodar o e2e** (o usuário deixou para o fim):
   1. reiniciar o `pnpm dev`, porque `src/instrumentation.ts` fixa o fuso America/Sao_Paulo;
   2. rodar `pnpm e2e`;
   3. ajustar os testes desatualizados e corrigir com teste de serviço o que for bug;
   4. conferir o layout da Prioridade 3 a 360, 1024 e 1280 px, no claro e no escuro.

   Estes testes devem quebrar por causa das mudanças:
   - textos que mudaram de nome ("Painel", "Restam N de M", "N cobranças no mês", "Cancelar a cobrança?");
   - confirmações novas (cobrança avulsa repetida, vencimento no passado, pular faixa);
   - notas só para quem estava na turma no dia;
   - landing com sessão mostrando "Ir para o painel".
2. **Backend no Supabase:** `docs/technical/08-backend-supabase.md`. Inclui a assinatura do cookie de sessão (ACE-43).
