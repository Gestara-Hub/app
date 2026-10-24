# 22 — O que falta no frontend antes do backend

> Histórico: levantamento de 14/10/2026, anterior ao backend (que existe desde 19/10/2026). O que ainda vale está em `docs/pendencias.md`.

> **Status:** 14/10/2026. Levantamento depois das fases A a D do [doc 20](20-plano-novas-formas-de-cobranca.md). Itens com **proposta** aguardam decisão; os outros podem andar sem decisão nova.
> Backend: [../technical/08-backend-supabase.md](../technical/08-backend-supabase.md) e [../technical/06-passagem-backend.md](../technical/06-passagem-backend.md).

## 1. Em andamento ou feito nesta rodada

| Item | Situação |
|---|---|
| Gerador de certificado v1 (Pro): layouts, cor, título, texto com variáveis, assinaturas, logo, prévia | Em implementação ([doc 21](21-ideias-certificados-e-notas.md) §1) |
| Menu de clique direito nas linhas de Cobranças (padrão de telas) | Em implementação |
| Textos que diziam "academia" em telas de todas as áreas | Feito (restam os de Configurações, junto com o certificado) |

## 2. Precisa de decisão

| # | Item | Recomendação |
|---|---|---|
| 1 | **Notas dos alunos** (fase 1: avaliações por turma, lançamento, boletim) | Proposta em [doc 21](21-ideias-certificados-e-notas.md) §2.1: liga por modalidade com padrão da área, escala por modalidade, Grátis lança e Pro integra |
| 2 | **Ficha do aluno** (página própria `/clients/[id]`) | **Feito (14/10/2026), simplificada em 18/10/2026 (doc frontend/07 §1.8).** Topo só com nome e situação; "Editar" e o menu ⋮ (editar, enviar WhatsApp, nova cobrança, vender pacote, inativar ou reativar). Avisos só do que pede ação (atraso com "Marcar pago" e "Cobrar", faltas seguidas, pacote acabando, aniversário hoje ou amanhã). Sanfona com uma linha de resumo por seção, fechadas por padrão (`?tab=` abre uma): Turmas (próxima aula e matrículas), Cobranças (extrato com todos os tipos e as ações da tela Cobranças), Pacotes (só com pacote), Evolução, Mensagens e Cadastro. A leitura é o "resumo do aluno" (`StudentSummary`, `studentSummaryService.getStudentSummary`), o mesmo que a API e os apps vão usar. Abre pelo nome do aluno em Alunos (e "Abrir ficha" no menu), na turma, na aula e em Cobranças |
| 3 | **Escopo dos apps de aluno e professor** | Escrever antes do backend, porque muda a API. Rascunho na seção 3 |
| 4 | "Outra área" na configuração inicial: perguntar **como cobra** (mensalidade, curso, pacote, não cobra) | **Feito (14/10/2026).** "Como você cobra?" no setup grava `customSegmentBilling`; vira a cobrança padrão da área (nova turma, cadastro do aluno, primeiros passos). Ver [doc 08](../frontend/08-decisoes-landing-page-e-onboarding.md) §4.3 e §4.5. Falta o mesmo campo em Configurações |
| 5 | Menu "Planos" virar **"Planos e pacotes"** | **Feito (14/10/2026).** Menu e título da tela; a rota segue `/classes/plans` |
| 6 | Página inicial citar **curso com valor fechado** e **pacote de aulas** | **Feito (14/10/2026).** Ponto "Mensalidade, curso fechado ou pacote de aulas" no pilar Gestão Financeira e uma pergunta no FAQ |
| 7 | Repasse: mensalidade dividida só entre turmas de mensalidade | Manter (evita pagar o professor do curso duas vezes) |
| 8 | Pacote usado até o fim (ainda válido) em "pacotes acabando" | **Feito (14/10/2026).** Entra como "as aulas acabaram", depois dos vencidos e antes dos que vencem; mesmas ações (avisar e vender pacote) |
| 9 | **Rodada de testes no navegador** das fases A a D e da tela "Cobranças" | **Feito (14/10/2026).** 381 testes de navegador (turmas), todos passando; defeitos achados foram corrigidos |

## 3. Rascunho: apps de aluno e professor (React Native)

**Aluno**
- Entrar com o login do Supabase (convite do espaço por telefone ou e-mail).
- Ver horários das turmas, próximas aulas e presenças.
- Pacote: saldo, validade, renovar.
- Cobranças: em aberto e pagas, pagar online (Pro), comprovante.
- Evolução: faixa/nível/módulo, registros de aula e metas; notas e boletim quando existirem.
- Certificado de conclusão (Pro).
- Avisos: mensagens do espaço, aniversário, pacote acabando.

**Professor**
- Turmas do dia e chamada (com gasto de pacote).
- Registros de aula e metas, graduação dos alunos dele.
- Notas (quando existirem).
- Repasse do mês (prévia e pagamentos).

**Impacto na API:** "resumo do aluno" (mesmo da ficha do aluno), lista de aulas do aluno e do professor, chamada como transação única (presença + gasto de pacote), regras de acesso por aluno (o aluno só vê os próprios dados) e por professor (escopo das turmas dele), já previstas no RLS do [doc 08](../technical/08-backend-supabase.md).
