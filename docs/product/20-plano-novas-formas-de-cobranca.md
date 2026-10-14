# 20 — Plano: novas formas de cobrança (curso fechado, pacote de aulas, cobrança avulsa)

> **Status:** 14/10/2026. Recomendações da seção 5 **aceitas**. **Fase A (cobrança avulsa) entregue em 14/10/2026** (regras em [15-regras-de-cobranca.md](15-regras-de-cobranca.md), seção "Cobrança avulsa"); B, C e D pendentes. Nasce da abertura para novas áreas (gastronomia, artes, beleza e cursos livres): elas vendem de um jeito que o sistema ainda não cobra.
> Base: regras atuais em [15-regras-de-cobranca.md](15-regras-de-cobranca.md), motor em `packages/core/src/billing.ts`, contratos em `packages/contracts/src/billing.ts` e `class.ts`.

## 1. O que existe hoje

| Forma | Como funciona | Quem usa |
|---|---|---|
| Mensalidade contínua | Plano do aluno (`Client.planId`), mensal, quinzenal ou semanal, gerada todo período pelo motor | Academias, escolas de música e idiomas |
| Aula avulsa | Cobrança por aula (`ChargeKind = "dropin"`), preço da turma | Quem paga por aula |
| Sem cobrança | Aluno sem plano, ou bolsa integral | Bolsistas, projetos sociais |

A turma já aceita data de término (`ClassGroup.endDate`), mas nada na cobrança usa isso.

## 2. O que falta

| Lacuna | Exemplos | O que precisa |
|---|---|---|
| **Cobrança avulsa** | Taxa de matrícula, material, uniforme, kimono, insumos da aula, taxa do exame de faixa, evento | Cobrar qualquer valor de um aluno, com descrição, vencimento e parcelas |
| **Curso fechado** | Curso de confeitaria de 8 encontros, maquiagem, cerâmica, cursinho, oficina de um dia | Turma com começo e fim, valor do curso, à vista ou parcelado; a matrícula gera as parcelas |
| **Pacote de aulas** | 10 aulas de beach tennis, 8 de pilates, aulas particulares, autoescola | Comprar N aulas por um valor, gastar uma por aula, saldo, validade e renovação |

Aula particular 1 a 1 já funciona (turma com 1 vaga) e passa a poder ser paga por pacote.

## 3. Desenho proposto

Princípio: **tudo continua sendo `Charge`.** Mensalidades, financeiro, pagamento online, lembretes de WhatsApp e relatórios já sabem lidar com cobrança; as formas novas só criam cobranças de outros tipos.

- `ChargeKind` ganha `"extra"` (avulsa), `"course"` (parcela de curso) e `"package"` (compra de pacote). Parcelas reaproveitam `cycleIndex`/`cycleTotal` ("2 de 4"). `description` para o texto da avulsa.
- **Turma** ganha a forma de cobrança: `billingMode: "membership" | "course" | "free"`, com `coursePriceCents` e `maxInstallments` no curso. A área do espaço sugere o padrão (gastronomia, artes e beleza: curso).
- **Matrícula em curso** guarda a escolha do aluno (à vista ou N parcelas, 1º vencimento) e gera as parcelas na hora.
- **Pacote**: `LessonPackage` (nome, quantidade de aulas, preço, validade em dias, modalidades em que vale), cadastrado como os planos; `StudentPackage` (compra do aluno: saldo, usadas, vence em, cobrança ligada).
- Mensalidade continua no aluno; curso fica na matrícula; pacote fica no aluno. Um aluno pode ter os três ao mesmo tempo.

## 4. Fases

Cada fase fecha com testes de regra (`packages/core`), de service (Vitest) e de tela (Playwright), como na rodada de 14/10/2026.

| Fase | Entrega | Tamanho |
|---|---|---|
| **A. Cobrança avulsa** ✅ 14/10/2026 | "Nova cobrança" no aluno e em Mensalidades: descrição, valor, vencimento, 1 a 12 parcelas. Aparece em Mensalidades (filtro "Tipo"), no Financeiro e no pagamento online. O lembrete de WhatsApp ficou para a D. Base para B e C. | Pequeno |
| **B. Curso fechado** | Forma de cobrança na turma; matrícula pergunta "à vista ou parcelado" e gera as parcelas; turma terminada encerra a matrícula ("Concluído"); cancelamento cancela só as parcelas futuras; vagas e lista de espera como hoje. Padrão por área. | Médio |
| **C. Pacote de aulas** | Cadastro de pacotes (em Planos); venda ao aluno gera a cobrança; a chamada gasta uma aula; saldo na ficha, na chamada e no aluno; validade; aviso de "última aula" e de vencimento; renovar. Aluno com pacote entra em qualquer aula das modalidades do pacote, como o avulso hoje, mas gastando crédito. | Médio a grande |
| **D. Acabamento** | Modelos de WhatsApp novos ("parcela do curso", "pacote acabando"); "Para fazer hoje" com pacotes acabando; certificado de conclusão do curso (PDF simples no navegador); relatórios por curso e por pacote; repasse de professor incluindo curso e pacote (decisão 5). | Médio |

**Ordem e backend:** fazer A, B e C ainda no mock, antes da fatia 4 do backend (Cobrança, [06-passagem-backend.md](../technical/06-passagem-backend.md)), porque mudam os contratos, que são a especificação da API. As fatias 1 a 3 do backend (login, alunos, turmas) podem começar em paralelo. D pode vir depois.

## 5. Decisões de produto (com recomendação)

| # | Pergunta | Recomendação |
|---|---|---|
| 1 | Curso: aluno que cancela no meio | Parcelas pagas ficam, as futuras são canceladas; sem multa automática (o dono lança uma cobrança avulsa se quiser). |
| 2 | Curso: entrar com o curso em andamento | Pode; valor cheio por padrão, editável na matrícula. |
| 3 | Curso: parcelas | O dono define o máximo de parcelas na turma; o aluno escolhe de 1 até esse máximo; vencimento mensal a partir da data escolhida. |
| 4 | Pacote: o que gasta uma aula | Presença gasta. Falta sem justificativa também gasta, com opção no pacote para não gastar. Falta justificada nunca gasta. |
| 5 | Pacote: validade | Opcional por pacote. Vencido, o saldo é perdido (aviso antes: 7 dias e na última aula). |
| 6 | Pacote: comprar outro com saldo | Pode; o saldo soma e a validade é a do pacote novo. |
| 7 | Repasse do professor (percentual) | Passa a ser "% do que os alunos pagaram": curso pela turma; pacote pelo valor de cada aula dada (preço ÷ aulas). Mensalidade como hoje. |
| 8 | Bolsa e desconto em curso e pacote | Só ajuste manual do valor na matrícula ou na venda; a bolsa automática continua só na mensalidade. |
| 9 | Pagamento online (Pro) | Vale para parcelas, avulsas e pacotes (são cobranças). Pix Automático continua só na mensalidade. |

## 6. Impacto em outras partes

- **Mensalidades:** a tela passa a listar todos os tipos; avaliar renomear para "Cobranças" (o filtro "Tipo" já existe).
- **Financeiro:** entradas novas entram no resumo como as mensalidades; nada novo no cálculo.
- **Configuração inicial e página:** a área sugere a forma de cobrança da primeira turma; a página pode citar "cursos com valor fechado" e "pacotes de aulas" quando B e C existirem.
- **Backend:** tabelas novas (`lesson_packages`, `student_packages`) e campos na turma e na matrícula; o gasto de aula do pacote acontece junto da chamada, na mesma transação.

## 7. Fase A entregue (14/10/2026)

O que foi feito: `ChargeKind` `"extra"`, `Charge.description` e `Charge.installmentGroupId`, `CreateExtraCharge`, `splitInstallments` e `describeCharge` no core, `billingService.createExtraCharge`, diálogo `NewExtraChargeDialog` (Mensalidades e menu do aluno), filtro "Cobranças avulsas", categoria de sistema "Cobranças avulsas" (`extras`) e migração v33.

Decisões tomadas na implementação:

- **Inativar o aluno mantém todas as avulsas em aberto**, inclusive parcelas futuras, mesmo com "Cancelar a cobrança" das mensalidades (a escolha do diálogo é só das mensalidades). Mesmo espírito da decisão 1: o que foi comprado continua devido; para não cobrar, cancela-se a parcela à mão. O diálogo avisa.
- **Sem lembrete de WhatsApp para avulsa** até a fase D (os modelos falam de "mensalidade"). O "Cobrar online" monta o texto próprio ("Segue a cobrança "Kimono"...").
- **Resto dos centavos na primeira parcela**; dia 31 cai no último dia dos meses curtos e volta a 31 (calculado sempre a partir do 1º vencimento). Total menor que o número de parcelas é recusado (parcela de R$ 0 não é cobrança).
- **Só aluno ativo** recebe cobrança avulsa (o inativo é recusado com mensagem no campo Aluno).
- **Rótulo nas auditorias:** "parcela 2 de 3 da cobrança avulsa "Kimono" de Ana" (`describeCharge`, também usado pelo pagamento online).
- **Motivos sugeridos ao cancelar** uma avulsa trocam "Plano errado" por "Lançada por engano".
- Depois de lançar em Mensalidades, a tela abre o mês da primeira parcela quando ele for outro.
- A tela continua com o nome "Mensalidades" (renomear para "Cobranças", seção 6, segue em avaliação).
