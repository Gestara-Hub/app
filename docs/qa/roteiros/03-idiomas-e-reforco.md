# Roteiro 03: Idiomas e reforço

**Cobre:** trilha de níveis, notas (escala de 0 a 10, mínima 6), aluno menor com responsável, mensagem com contador e avanço de nível.

Comece do zero (ver [README](README.md)).

## 1. Configuração inicial

1. Nome: **Escola Fala Fácil**. Continuar.
2. Área: **Idiomas e reforço**.
3. Aulas: deixe **Inglês** e **Espanhol**. Concluir.

## 2. Primeiros passos

1. **Horários:** todos os dias, 06:00 às 22:00. Salvar horários.
2. **Regras da mensalidade:** confirme as recomendadas.
3. **Modalidades:** abra Inglês.
   - Esperado: trilha de níveis e avaliações ligadas (0 a 10, mínima 6).
   - Confirme "Está tudo certo".
4. **Plano:** **Inglês Mensal**, Mensal, **R$ 250,00**.
5. **Equipe:** **Marina Costa**, modalidade Inglês.

## 3. Turma

Nova turma:
- **Inglês Básico A**, Inglês, Marina Costa, 10 vagas.
- Encontros: dia da semana de hoje, 19:00 às 20:00.
- Cobrança: Mensalidade.

## 4. Alunos

Todos "Paga mensalidade", plano Inglês Mensal:

| Nome | Nascimento | Telefone | Extra |
|---|---|---|---|
| **Rafael Moura** | 15/08/2010 | (11) 97777-1111 | Responsável: **Paula Moura**, Mãe, (11) 97777-0000 |
| **Larissa Campos** | 22/02/1998 | (11) 97777-2222 | |
| **Diego Nunes** | 10/10/2000 | (11) 97777-3333 | |

## 5. Matrícula, chamada e notas

1. Inglês Básico A > Matricular alunos: os 3.
2. **Hoje · Fazer chamada**:
   - os 3 presentes;
   - Concluir chamada.
3. Aba **Avaliações** > Nova avaliação:
   1. Tente **Prova 1** com a data de **amanhã**.
      - Esperado: "A avaliação não pode ter data futura."
   2. Use a data de **hoje**, peso 1.
4. **Lançar notas**:
   - Rafael **8,5**;
   - Larissa **5**;
   - Diego **Faltou**.
   - Esperado: Larissa destacada abaixo da mínima.

## 6. Evolução

1. Na aula de hoje, **Registrar a aula**:
   - Rafael, tom **Evolução**, "Leitura melhorou";
   - Larissa, tom **Ajustar**, "Revisar verbos".
2. Ficha do Rafael > Evolução > botão **Níveis** do cartão de Inglês: avançar para o **próximo nível**, data de hoje.

## 7. Mensagens

1. Ficha da **Larissa** > Mensagens > Nova mensagem.
   - Escreva "Parabéns pela prova! 🎉".
   - Esperado: contador "22 de 1000" (o emoji conta 1).
   - Envie (abre o WhatsApp).
2. Ficha do **Diego** > Mensagens.
   - Esperado: só o vazio com "Nova mensagem" (sem busca nem filtro, porque ainda não há mensagem).

## O que vou conferir no JSON

- `categories`:
  - Inglês com `progressionTrack` de níveis;
  - `assessments` ligada, `zero_ten`, mínima 6.
- `clients`: Rafael com responsável (Paula Moura, Mãe).
- `assessments`: "Prova 1" com data de hoje e as notas 8,5, 5 e falta.
- `clients[].progressions`:
  - Rafael no 2º nível, com histórico;
  - registros de aula `positive` (Rafael) e `attention` (Larissa).
- `messageLogs`: mensagem para a Larissa com status `opened`.
- `auditLog`: "abriu no WhatsApp uma mensagem para Larissa Campos".
