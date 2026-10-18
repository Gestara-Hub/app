# Roteiro 01: Lutas

**Cobre:** faixas por modalidade (Jiu-Jitsu e Muay Thai), faixas infantis por idade, graus, mensalidade com desconto, chamada, registro da aula e graduação.

Comece do zero (ver [README](README.md)).

## 1. Configuração inicial

1. Nome: **Academia Tatame**. Continuar.
2. Área: **Lutas** (avança sozinho).
3. Aulas: deixe marcadas só **Jiu-Jitsu** e **Muay Thai**. Concluir.
   - Esperado: cai no Painel com "Primeiros passos".

## 2. Primeiros passos

1. **Horários:** todos os dias (domingo também), 06:00 às 22:00. Salvar horários.
2. **Regras da mensalidade:** confirme as recomendadas (Antecipado, Proporcional, todo dia 10).
3. **Modalidades:** abra Jiu-Jitsu e confira a trilha de faixas (infantis com idade e adultas). Volte e confirme "Está tudo certo".
4. **Plano:** Planos e pacotes > Novo plano: **Mensal Jiu-Jitsu**, Mensal, **R$ 180,00**.
5. **Equipe:** Novo profissional: **Carlos Silva**, modalidade Jiu-Jitsu.

## 3. Turmas

Crie em Turmas > Nova turma:

| Nome | Modalidade | Professor | Vagas | Encontros | Cobrança |
|---|---|---|---|---|---|
| **Jiu-Jitsu Adulto** | Jiu-Jitsu | Carlos Silva | 20 | dia da semana de hoje, 19:00 às 20:30 | Mensalidade |
| **Jiu-Jitsu Kids** | Jiu-Jitsu | Carlos Silva | 15 | dia da semana de hoje, 17:00 às 18:00 | Mensalidade |

Data de início: hoje (o padrão).

## 4. Alunos

Alunos > Novo aluno, "Paga mensalidade", plano **Mensal Jiu-Jitsu**, vencimento recorrente 10:

| Nome | Nascimento | Telefone | Extra |
|---|---|---|---|
| **Lucas Ferreira** | 12/05/1995 | (11) 98123-4567 | |
| **Ana Souza** | 03/09/1990 | (11) 97654-3210 | Desconto de **10%** |
| **Pedro Alves** | 20/03/2016 | (11) 96543-2109 | Responsável: **Marta Alves**, Mãe |

- Esperado na Ana: "Plano R$ 180,00 → paga R$ 162,00".
- Esperado no Pedro: aviso de menor de idade pedindo responsável.

## 5. Matrícula e chamada

1. Jiu-Jitsu Adulto > Matricular alunos: **Lucas** e **Ana**.
2. Jiu-Jitsu Kids > Matricular alunos: **Pedro**.
3. Na Jiu-Jitsu Adulto, use o atalho **Hoje · Fazer chamada**.
   - Toque no **Lucas** (presente).
   - No ⋮ da **Ana**, Marcar falta.
   - Concluir chamada.
4. Ainda na aula, **Registrar a aula**:
   - Lucas: tom **Evolução** e anotação "Boa guarda fechada".
   - Salvar registros.

## 6. Graduação

1. Ficha do Lucas > Evolução > **Graduação**: dar o **1º grau** na Faixa Branca, data de hoje. Confirmar.
   - Esperado: chip "Faixa Branca · 1º grau".
2. Ficha do Pedro > Evolução > Graduação > **Escolher outra**.
   - Esperado: só faixas infantis da idade dele (filtro pela idade).
   - Escolha **Faixa Amarela** (pula a Cinza).
   - Esperado: pede confirmação ("Pular para Faixa Amarela?").
   - Confirme.

## 7. Cobranças

1. Cobranças: confira as 3 mensalidades do mês (Ana com R$ 162,00 no período cheio).
2. No ⋮ do **Lucas**, **Marcar pago** com Pix e data de hoje.
   - Esperado: "pago via Pix em dd/MM".

## O que vou conferir no JSON

- `categories`: Jiu-Jitsu e Muay Thai com trilha de faixas (`style: "belt"`); faixas infantis com `minAge`/`maxAge`.
- `classGroups`: 2 turmas de mensalidade com o dia de hoje nos encontros.
- `clients`:
  - os 3 com `planId` e `dueDay: 10`;
  - Ana com `discount` 10%;
  - Pedro com responsável.
- `enrollments`: 3 ativas.
- `charges`:
  - mensalidades do mês;
  - a do Lucas `paid`, com `method: "pix"` e `paidAt` de hoje.
- `attendances`: Lucas `present` e Ana `absent` na aula de hoje.
- `clients[].progressions`:
  - Lucas com `subLevel: 1` e registro de aula `positive`;
  - Pedro na Faixa Amarela;
  - os dois com histórico de graduação.
- `auditLog`: cadastro, matrícula, pagamento e graduações.
