# Roteiro 04: Gastronomia

**Cobre:** turma de curso com valor fechado, parcelas, vencimento no passado, pagamento de parcela e cancelamento da matrícula. O certificado só aparece com o curso encerrado, então fica fora deste roteiro.

Comece do zero (ver [README](README.md)).

## 1. Configuração inicial

1. Nome: **Doce Escola**. Continuar.
2. Área: **Gastronomia**.
3. Aulas: deixe **Confeitaria** e **Panificação**. Concluir.
   - Esperado: os Primeiros passos **não** pedem regras da mensalidade (área de curso).

## 2. Primeiros passos

1. **Horários:** todos os dias, 06:00 às 22:00. Salvar horários.
2. **Equipe:** **Bruno Chef**, modalidade Confeitaria.

## 3. Turma de curso

Nova turma:
- **Confeitaria Básica**, Confeitaria, Bruno Chef, 12 vagas.
- Encontros: dia da semana de hoje, 09:00 às 12:00.
- Cobrança: **Curso com valor fechado**:
  - Valor do curso **R$ 900,00**;
  - Parcelas até **3x**;
  - Termina em: **último dia do mês que vem**.

## 4. Alunos

Alunos > Novo aluno, "Não paga mensalidade":
- **Carla Mendes**, (11) 96666-1111;
- **João Pedro**, (11) 96666-2222;
- **Fernanda Lima**, (11) 96666-3333.

## 5. Matrículas

Na Confeitaria Básica > Matricular alunos, um de cada vez:

1. **Carla:** mantenha o padrão ("R$ 900,00 à vista, vence hoje").
2. **João:** em "Alterar", **3x**, 1º vencimento **hoje**.
   - Esperado: "3x de R$ 300,00" com as três datas.
3. **Fernanda:** em "Alterar", valor **R$ 800,00**, **2x**, 1º vencimento **ontem**.
   - Esperado: "Data que já passou: a cobrança entra atrasada."

## 6. Cobranças

1. Cobranças, filtro **Cursos**.
   - Esperado: 6 parcelas (Carla 1, João 3, Fernanda 2).
   - A 1ª da Fernanda aparece atrasada.
2. No ⋮ da 1ª parcela do **João**, **Marcar pago** (Dinheiro, hoje).

## 7. Cancelar matrícula

1. Turma > ⋮ da **Fernanda** > Cancelar matrícula.
   - Esperado: o texto diz que a parcela vencida continua para receber e a futura será cancelada.
2. Confirme.

## O que vou conferir no JSON

- `organization.settings`: sem regras de mensalidade pendentes.
- `classGroups`: `billingMode: "course"`, `coursePriceCents: 90000`, `courseMaxInstallments: 3`, `endDate` no fim do mês que vem.
- `charges` do tipo `course`:
  - Carla: 1 de R$ 900,00;
  - João: 3 de R$ 300,00, a 1ª `paid` em dinheiro;
  - Fernanda: 2 de R$ 400,00. A vencida segue em aberto e a futura está `canceled`.
- `enrollments`: Fernanda `canceled`; Carla e João ativas.
- `auditLog`: matrículas no curso com parcelas, pagamento e cancelamento.
