# 21 — Ideias: gerador de certificados e notas dos alunos

> **Status:** 14/10/2026. **Ideias registradas para refinar depois**, não decididas nem planejadas. Vieram da fase D do [doc 20](20-plano-novas-formas-de-cobranca.md) e da abertura para novas áreas (cursos livres, idiomas, reforço, profissionalizantes).

## 1. Certificado: Plano Pro e gerador de modelos

**Decidido (14/10/2026):** o certificado de conclusão do curso é recurso **pago** (Pro). No Grátis, a opção aparece com cadeado e o aviso do plano.

**Hoje (fase D):** um modelo único, pronto para imprimir ou salvar em PDF pelo navegador: aluno, curso, período, número de aulas e frequência, com linhas de assinatura.

**Ideia para depois: gerador de certificado.** O dono cria o próprio modelo:
- escolher entre alguns layouts (clássico, moderno, infantil) e cores;
- enviar logo e assinatura (imagem);
- editar o texto com variáveis (`{aluno}`, `{curso}`, `{inicio}`, `{fim}`, `{aulas}`, `{carga_horaria}`, `{frequencia}`, `{nota}`, `{professor}`, `{empresa}`), como nos modelos de mensagem;
- um modelo padrão por modalidade ou por curso;
- emitir em lote para todos os concluídos de uma turma;
- código de verificação no certificado (página pública que confirma que ele é verdadeiro).

**Pontos a decidir:** carga horária (vem das aulas dadas ou é informada no curso?); critério mínimo para emitir (frequência mínima, nota mínima); se o aluno baixa o próprio certificado pelo app; guardar o certificado emitido (histórico) ou gerar sempre na hora.

**Cuidado no desenho atual:** os dados do certificado ficam separados do layout, para o gerador entrar sem reescrever a emissão.

## 2. Notas dos alunos (avaliações)

**Motivo:** várias áreas lançam nota: idiomas (provas por nível), reforço escolar e cursinho, música (prova prática), cursos profissionalizantes, natação e lutas (avaliação técnica em exame). Hoje a evolução tem trilha, registros de aula e metas, mas não tem nota.

**Ideia:**
- **Avaliação** ligada à turma ou à modalidade: nome ("Prova do módulo 2", "Exame de faixa"), data, tipo de nota (0 a 10, 0 a 100, conceito A–E, aprovado/reprovado) e peso.
- **Lançamento pelo professor:** tela parecida com a chamada, uma linha por aluno, rápida no celular.
- **Boletim do aluno:** notas por avaliação, média por módulo ou período, na ficha de evolução (perto de "Registros de aula").
- **Ligação com a trilha:** a nota pode virar critério para avançar ("média mínima 7 para passar de nível"), junto com presença e tempo, que são os critérios de hoje.
- **Ligação com o certificado:** a nota final pode aparecer no certificado e ser critério para emitir.
- **Comunicação:** avisar o aluno ou o responsável quando a nota sair (modelo de mensagem novo).
- **Relatórios:** desempenho por turma e por avaliação.

**Pontos a decidir:** grátis ou Pro (sugestão inicial: lançar notas no Grátis; boletim em PDF, critérios automáticos e relatórios no Pro); escalas por modalidade ou por espaço; recuperação e segunda chamada; quem pode lançar e editar (só o professor da turma? o dono?); o aluno vê as notas no app.

**Encaixe com o que existe:** as palavras seguem a trilha da modalidade (Faixa, Nível, Módulo, Fase); "Avaliação" e "Nota" entram no mesmo padrão. Metas e registros de aula continuam; a nota é um registro estruturado a mais na evolução.
