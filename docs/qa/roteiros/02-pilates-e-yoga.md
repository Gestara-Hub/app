# Roteiro 02: Pilates e yoga

**Cobre:** área sem trilha de evolução, mensalidade "depois do uso", plano quinzenal, bolsa parcial, turma pequena e falta justificada.

Comece do zero (ver [README](README.md)).

## 1. Configuração inicial

1. Nome: **Studio Equilíbrio**. Continuar.
2. Área: **Pilates e yoga**.
3. Aulas: deixe **Pilates Reformer** e **Pilates Solo**. Concluir.
   - Esperado: nos Primeiros passos **não** aparece "Falta revisar" nas modalidades (área sem trilha).

## 2. Primeiros passos

1. **Horários:** todos os dias, 06:00 às 22:00. Salvar horários.
2. **Regras da mensalidade:**
   - Momento do pagamento: **Depois do uso**.
   - Entrada no meio do período: **Proporcional**.
   - Vencimento: todo dia **5**.
   - Salvar.
   - Esperado na simulação: a mensalidade de um mês vence no dia 5 do mês seguinte.
3. **Planos:**
   - **Pilates 2x semana**, Mensal, **R$ 320,00**.
   - **Pilates Quinzenal**, Quinzenal, **R$ 170,00**.
4. **Equipe:** **Juliana Prado**, modalidades Pilates Reformer e Pilates Solo.

## 3. Turma

Nova turma:
- **Reformer Manhã**, Pilates Reformer, Juliana Prado, **6 vagas**.
- Encontros: dia da semana de hoje, 07:00 às 07:50.
- Cobrança: Mensalidade.

## 4. Alunos

| Nome | Telefone | Como paga |
|---|---|---|
| **Helena Martins** | (11) 98888-1111 | Paga mensalidade, Pilates 2x semana |
| **Sofia Ribeiro** | (11) 98888-2222 | Paga mensalidade, **Pilates Quinzenal** |
| **Bruno Lima** | (11) 98888-3333 | **Bolsista** parcial, **50%**, plano Pilates 2x semana, motivo "Social" |

- Esperado na Sofia: o campo do vencimento diz "Dia do vencimento (1ª quinzena)" e a dica mostra os dois dias do mês.
- Esperado no Bruno: "Plano R$ 320,00 → paga R$ 160,00 (bolsa de 50%)".

## 5. Matrícula e chamada

1. Reformer Manhã > Matricular alunos: os 3.
   - Esperado: "3 de 6 alunos".
2. **Hoje · Fazer chamada**:
   - **Helena** presente.
   - **Sofia**: ⋮ Justificar falta.
   - **Bruno** presente.
   - Concluir chamada.

## 6. Ficha e cobranças

1. Ficha da Helena > Evolução.
   - Esperado: "As turmas deste aluno são de modalidades sem trilha de níveis."
2. Cobranças: confira as mensalidades.
   - Esperado:
     - "depois do uso": o período deste mês vence no dia 5 do mês seguinte;
     - Bruno com R$ 160,00 no período cheio;
     - Sofia por quinzena.
3. Editar o Bruno: mude a bolsa para **40%**.
   - Esperado: "Vale a partir do próximo período; o atual não muda."
   - Salvar.

## O que vou conferir no JSON

- `organization.settings`:
  - `billingTiming: "postpaid"`, `midMonthStrategy: "prorated"`, `defaultDueDay: 5`;
  - sem `modalitiesReviewed: false`.
- `categories`: sem trilha ligada.
- `plans`: um mensal e um quinzenal.
- `clients`: Sofia no plano quinzenal; Bruno com bolsa (`scholarship`) de 40% depois da edição.
- `charges`:
  - mensalidades com vencimento no mês seguinte;
  - as quinzenas da Sofia;
  - período atual do Bruno inalterado e os próximos com 40%.
- `attendances`: Helena e Bruno `present`, Sofia `justified`.
