# Roteiro 05: Outra área com pacote de aulas

**Cobre:**
- área com nome próprio e a sugestão de área da lista;
- trilha de níveis escolhida na mão;
- pacote de aulas: vale só nas turmas escolhidas, só a partir da compra, o que vence primeiro paga e a falta gasta;
- turma sem cobrança, que não gasta pacote;
- Auditoria da chamada.

Comece do zero (ver [README](README.md)).

## 1. Configuração inicial

1. Nome: **Rocha Escalada**. Continuar.
2. Área: **Outra área**.
   1. Em "O que você ensina?", digite **Lutas**.
      - Esperado: "Já existe a área Lutas... Usar Lutas". **Não clique.**
   2. Troque o nome para **Escalada**.
   3. Como seus alunos avançam: **Níveis**.
   4. Como você cobra: **Pacote de aulas**.
   5. Continuar.
3. Aulas: desmarque **Escalada** (vem marcada com o nome da área), adicione **Boulder** e **Top rope**. Concluir.

## 2. Primeiros passos

1. **Horários:** todos os dias, 06:00 às 22:00. Salvar horários.
2. **Equipe:** **Tiago Rocha**, modalidades Boulder e Top rope.

## 3. Turmas

Nova turma, todas com o **dia da semana de hoje** nos encontros:

| Nome | Modalidade | Vagas | Horário | Cobrança |
|---|---|---|---|---|
| **Boulder Livre** | Boulder | 12 | 07:00 às 08:00 | Pacote de aulas |
| **Top rope Iniciante** | Top rope | 8 | 09:00 às 10:00 | Pacote de aulas |
| **Treino aberto** | Boulder | 20 | 11:00 às 12:00 | Sem cobrança |

## 4. Pacotes

Planos e pacotes > aba **Pacotes de aulas** > Novo pacote:

| Nome | Aulas | Valor | Validade | Turmas | Falta gasta |
|---|---|---|---|---|---|
| **10 aulas** | 10 | R$ 500,00 | 60 dias | nenhuma (vale em todas) | ligado |
| **4 aulas Top rope** | 4 | R$ 220,00 | 30 dias | só **Top rope Iniciante** | ligado |

## 5. Alunos e vendas

1. Novo aluno **Marcos Vieira**, (11) 95555-1111.
   - Como paga: **Pacote de aulas**, pacote **10 aulas**, à vista.
2. Novo aluno **Paula Reis**, (11) 95555-2222, "Não paga mensalidade".
   - Depois, na lista, ⋮ > **Vender pacote** > **4 aulas Top rope**, 2x.
3. Matricule:
   - **Marcos** em Boulder Livre e em Treino aberto;
   - **Paula** em Top rope Iniciante.

## 6. Chamadas de hoje

1. **Boulder Livre**, Fazer chamada: **Marcos** presente. Concluir.
   - Esperado: na linha do Marcos, "9 de 10 aulas"; na ficha dele, o selo "Restam 9 de 10".
2. **Treino aberto**, Fazer chamada: **Marcos** presente. Concluir.
   - Esperado: sem saldo de pacote na linha; a ficha continua "Restam 9 de 10" (turma sem cobrança não gasta).
3. **Top rope Iniciante**, Fazer chamada: ⋮ da **Paula** > Marcar falta.
   - Esperado: "3 de 4 aulas" (falta gasta).
4. Na mesma aula, ⋮ da **Paula** > Justificar falta.
   - Esperado: volta para "4 de 4 aulas".

## 7. Auditoria

Auditoria. Esperado:
- "descontou 1 aula do pacote de Marcos Vieira (presença em Boulder Livre, dd/MM)";
- "descontou 1 aula do pacote de Paula Reis (falta em Top rope Iniciante, dd/MM)";
- "devolveu 1 aula ao pacote de Paula Reis (falta justificada em Top rope Iniciante, dd/MM)".

## O que vou conferir no JSON

- `organization`:
  - `classSegment: "custom"`, `customSegmentName: "Escalada"`;
  - `customSegmentProgression: "levels"`, `customSegmentBilling: "package"`.
- `categories`: Boulder e Top rope com trilha de níveis.
- `lessonPackages`: "10 aulas" sem turmas (vale em todas); "4 aulas Top rope" com `classGroupIds` só da Top rope.
- `classGroups`: duas de pacote e uma `free`.
- `studentPackages`:
  - Marcos: 1 aula usada (Boulder), nenhuma do Treino aberto;
  - Paula: nenhuma usada depois da justificativa.
- `charges` do tipo `package`: Marcos 1 de R$ 500,00; Paula 2 de R$ 110,00.
- `attendances`: as três chamadas de hoje (Marcos `present` duas vezes, Paula `justified`).
- `auditLog`: as três linhas acima.
