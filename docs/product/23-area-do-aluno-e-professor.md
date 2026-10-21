# 23 — Funcionalidades da Área do Aluno e do Professor

> **Status:** Aprovado em 20/10/2026. Mapeamento completo de funcionalidades para o aplicativo e portal web de alunos e professores, com matriz de distribuição por plano de assinatura (Grátis, Profissional e Expansão).

---

## 1. Visão Geral

O GestaraHub adota o modelo de **três pontas integradas**:
1. **Painel do Gestor / Recepção (Web Desktop):** Gestão financeira, turmas, matrículas, relatórios e configurações.
2. **Área do Aluno (Mobile / PWA / Web):** Frequência, evolução, pagamentos e comunidade.
3. **Área do Professor (Mobile / Tatame):** Chamada rápida, avaliação pedagógica, graduações e controle de repasses.

> **Regra de Produto:** Todos os planos (inclusive o Grátis) oferecem acesso à Área do Aluno e do Professor, sem limitação artificial de quantidade de alunos ou professores cadastrados. O diferencial entre os planos reside na **automação, conveniência, ferramentas pedagógicas avançadas e multiunidades**.

---

## 2. Catálogo Geral de Funcionalidades

### 2.1 Área do Aluno (Portal & App)

#### A. Frequência, Presença e Rotina
- **ALU-01 (Check-in e Reserva de Vagas):** Reserva prévia de lugar na aula com limite de lotação e fila de espera automática.
- **ALU-02 (Histórico de Frequência e Presenças):** Calendário visual de aulas concluídas, percentual de assiduidade e sequência de treinos (*streak*).
- **ALU-03 (Cancelamento de Presença):** Cancelamento com antecedência para liberar a vaga a quem está na fila de espera.
- **ALU-04 (Banco de Reposições):** Gestão e agendamento de aulas perdidas com créditos de reposição.
- **ALU-05 (Carteirinha Digital / QR Code):** Identificação visual para catracas, totens ou conferência rápida na recepção.

#### B. Graduação, Pedagogia e Evolução
- **ALU-06 (Trilha de Faixa / Grau / Nível):** Barra de progresso clara com contagem de presenças e critérios para a próxima graduação.
- **ALU-07 (Histórico de Graduações):** Linha do tempo com datas, fotos, faixas anteriores e nome do instrutor que graduou.
- **ALU-08 (Boletim e Avaliações Técnicas):** Visualização de notas e conceitos atribuídos pelo professor (postura, técnica, disciplina).
- **ALU-09 (Certificados Digitais Autênticos):** Download em PDF de certificados de conclusão e graduação com validação oficial por QR Code.

#### C. Financeiro e Pagamentos
- **ALU-10 (Painel de Mensalidades):** Consulta de faturas em aberto, pagas e recibos em PDF.
- **ALU-11 (Pix Instantâneo Copia e Cola / QR Code):** Pagamento em 1 clique sem sair do app.
- **ALU-12 (Cartão de Crédito com Recorrência):** Pagamento mensal no cartão sem travar o limite total do aluno.
- **ALU-13 (Pix Automático):** Débito recorrente autorizado diretamente pelo banco do aluno.
- **ALU-14 (Declarações de Quitação e IRPF):** Emissão automática de informes anuais para declaração de imposto de renda ou reembolso de convênio.
- **ALU-15 (Lojinha do Espaço):** Compra de uniformes, kimonos, faixas e itens do espaço direto pelo app.

#### D. Perfil, Saúde e Família
- **ALU-16 (Multi-Perfis Familiares):** Acesso único para pais gerenciarem múltiplos filhos dependentes.
- **ALU-17 (Ficha Médica e Anamnese):** Cadastro de restrições de saúde, alergias e contatos de emergência.
- **ALU-18 (Assinatura Digital de Termos):** Assinatura de contratos, termos de consentimento e uso de imagem na tela do celular.
- **ALU-19 (Atualização Cadastral):** Atualização de dados de contato e foto de perfil.

#### E. Comunicação e Comunidade
- **ALU-20 (Mural de Avisos e Recados):** Notificações da academia sobre feriados, workshops e campeonatos.
- **ALU-21 (Notificações Push / WhatsApp):** Lembretes automáticos antes da aula e felicitações de aniversário.
- **ALU-22 (Botão WhatsApp da Recepção):** Canal direto para falar com o suporte do espaço.

---

### 2.2 Área do Professor / Instrutor (Mobile Tatame)

#### A. Operação de Aula e Tatame
- **PRF-01 (Chamada Rápida com 1 Toque):** Presença, falta, reposição e aula avulsa em poucos segundos.
- **PRF-02 (Chamada com Feedback Sonoro):** Sons distintos de confirmação para agilizar a chamada no tatame.
- **PRF-03 (Modo Offline com Sincronização):** Realização da chamada mesmo sem sinal de internet na sala; sincroniza automaticamente ao reconectar.
- **PRF-04 (Fotos dos Alunos na Lista):** Identificação visual rápida de alunos recém-matriculados.
- **PRF-05 (Avisos Discretos de Recepção):** Ícone sutil alertando pendências administrativas ou atestado médico vencido.
- **PRF-06 (Registro de Alunos Experimentais):** Cadastro e anotação sobre interesse do visitante na aula experimental.
- **PRF-07 (Diário de Bordo da Aula):** Registro do conteúdo técnico ensinado e anotações sobre incidentes ou lesões.

#### B. Avaliação Pedagógica e Graduações
- **PRF-08 (Indicação para Exame de Graduação):** Seleção de alunos aptos para graduação para aprovação da coordenação/dono.
- **PRF-09 (Lançamento de Notas e Avaliações):** Atribuição de conceitos técnicos e notas pedagógicas pelo celular.
- **PRF-10 (Graduação Imediata no Tatame):** Registro imediato do grau ou faixa amarrada na hora do treino.
- **PRF-11 (Ficha Histórica do Aluno):** Acesso rápido à trajetória e tempo de treino do aluno.

#### C. Grade e Agenda
- **PRF-12 (Grade Semanal do Professor):** Visualização das turmas do dia e semana com contagem de alunos confirmados.
- **PRF-13 (Solicitação de Cobertura/Substituição):** Pedido para outro professor cobrir uma aula com aprovação do gestor.
- **PRF-14 (Registro de Ponto da Aula):** Confirmação de início e término da sessão para auditoria.

#### D. Financeiro do Professor
- **PRF-15 (Extrato de Aulas Ministradas):** Relatório detalhado das aulas dadas no mês.
- **PRF-16 (Painel do Saldo de Repasses em Tempo Real):** Estimativa do valor a receber (por hora/aula, percentual ou por aluno presente).
- **PRF-17 (Histórico de Quitações e Comprovantes):** Visualização de pagamentos recebidos e recibos anteriores.
- **PRF-18 (Cadastro de Chave Pix do Professor):** Manutenção dos dados bancários para recebimento.
- **PRF-19 (Solicitação de Acerto / Adiantamento):** Pedido de quitação direto pelo aplicativo.

#### E. Retenção e Relacionamento
- **PRF-20 (Recados para a Turma):** Disparo de avisos que aparecem no aplicativo de todos os alunos da turma.
- **PRF-21 (Radar de Alunos Ausentes / "Sumidos"):** Alerta automático de alunos sem comparecer há mais de 7 ou 14 dias para envio de mensagem de incentivo.
- **PRF-22 (Aniversariantes da Turma):** Lista semanal para parabenizar os alunos.
- **PRF-23 (Métricas de Retenção do Professor):** Taxa de assiduidade e fidelização dos alunos sob sua tutela.

---

## 3. Matriz de Distribuição por Plano de Assinatura

### 3.1 Área do Aluno

| Recurso do Aluno | Grátis (R$ 0) | Profissional (R$ 79,90) | Expansão (R$ 199,00) | Justificativa Estratégica / Proposta de Valor |
| :--- | :---: | :---: | :---: | :--- |
| **Histórico de presença e treinos** | ✅ | ✅ | ✅ | Essencial para o aluno acompanhar quantas aulas fez. |
| **Trilha de graduação (faixas e graus)** | ✅ | ✅ | ✅ | Engajamento básico de progressão pedagógica. |
| **Grade de horários e faltas** | ✅ | ✅ | ✅ | Operação transparente da rotina de treinos. |
| **Consulta de mensalidade (Pix Copia e Cola)** | ✅ | ✅ | ✅ | Aluno copia o código e paga no seu banco sem atrito. |
| **Multi-perfis familiares (pais e filhos)** | ✅ | ✅ | ✅ | Pais com 2 ou mais filhos gerenciam tudo em um único login. |
| **Ficha médica, anamnese e termos digitais** | ✅ | ✅ | ✅ | Assinatura de contrato e termos médicos pelo celular. |
| **Mural de avisos e recados da academia** | ✅ | ✅ | ✅ | Comunicação geral do espaço com a comunidade. |
| **Pagamento com 1 clique no app (Pix e Cartão)** | — | ✅ | ✅ | **Poderoso no Pro:** sem atrito, zera a inadimplência. |
| **Reserva antecipada de vaga e fila de espera** | — | ✅ | ✅ | Evita salas/tatames lotados em horários de pico. |
| **Cancelamento antecipado com liberação de vaga** | — | ✅ | ✅ | Aluno que não vai avisa e libera a vaga para outro da fila. |
| **Banco e agendamento de reposições** | — | ✅ | ✅ | O sistema controla sozinho os créditos de aula perdida. |
| **Download de Certificados Digitais com validação QR** | — | ✅ | ✅ | Gera valor para cursos, workshops e graduações. |
| **Lembretes e avisos automáticos no WhatsApp** | — | ✅ | ✅ | Robô da academia avisa sobre aulas, vencimentos e eventos. |
| **Lojinha de produtos internos no app** | — | ✅ | ✅ | Aluno compra kimonos, produtos e acessórios para retirar. |
| **Passe livre em qualquer filial da rede** | — | — | ✅ | Aluno pode treinar na filial do Centro ou da Praia. |
| **Página web comercial (Link na Bio e Matrícula)** | — | — | ✅ | Vitrine da academia para captar alunos e matricular online. |
| **Integração com Catraca / Check-in automatizado** | — | — | ✅ | Para grandes centros com controle físico automatizado. |

---

### 3.2 Área do Professor / Instrutor

| Recurso do Professor | Grátis (R$ 0) | Profissional (R$ 79,90) | Expansão (R$ 199,00) | Justificativa Estratégica / Proposta de Valor |
| :--- | :---: | :---: | :---: | :--- |
| **Chamada rápida com 1 toque no tatame** | ✅ | ✅ | ✅ | Operação diária do professor sem prancheta. |
| **Chamada com feedback sonoro** | ✅ | ✅ | ✅ | Confirmação rápida por áudio enquanto a turma treina. |
| **Modo offline com sincronização automática** | ✅ | ✅ | ✅ | Funciona mesmo se a internet da sala cair. |
| **Lista com fotos dos alunos** | ✅ | ✅ | ✅ | Ajuda o professor a gravar os nomes rapidamente. |
| **Grade de turmas e horários do professor** | ✅ | ✅ | ✅ | Professor sabe exatamente onde e quando dá aula. |
| **Registro de alunos em aula experimental** | ✅ | ✅ | ✅ | Anota se o visitante gostou para a recepção fechar. |
| **Extrato de aulas ministradas e valor acumulado** | ✅ | ✅ | ✅ | Transparência no cálculo do repasse do professor. |
| **Cadastro de chave Pix para receber repasses** | ✅ | ✅ | ✅ | Praticidade para o financeiro pagar o professor. |
| **Lançamento de notas pedagógicas e conceitos** | — | ✅ | ✅ | **Poderoso no Pro:** avaliações técnicas no celular. |
| **Indicação para exame de graduação pelo app** | — | ✅ | ✅ | Professor lista os alunos aptos e envia ao mestre. |
| **Graduação e lançamento de faixas no tatame** | — | ✅ | ✅ | Amarrou a faixa/grau, já atualiza na hora no app. |
| **Avisos discretos de recepção (atestado/pendência)** | — | ✅ | ✅ | Alerta silencioso para o professor orientar o aluno. |
| **Diário de bordo da aula (conteúdo e ocorrências)** | — | ✅ | ✅ | Registro pedagógico e de lesões/ocorrências. |
| **Radar de alunos ausentes ("sumidos há +7 dias")** | — | ✅ | ✅ | Professor manda WhatsApp para resgatar quem sumiu. |
| **Envio de recados diretos para a turma pelo app** | — | ✅ | ✅ | Ex: *"Tragam kimono branco para o treino de amanhã"*. |
| **Solicitação de acerto de repasse / adiantamento** | — | ✅ | ✅ | Professor solicita o fechamento pelo app. |
| **Atuação e grade unificada entre múltiplas filiais** | — | — | ✅ | O professor dá aula em 2 unidades com ponto unificado. |
| **Métricas de retenção por instrutor na rede** | — | — | ✅ | O dono compara a retenção entre diferentes unidades. |
| **Controle de cobertura de aulas entre unidades** | — | — | ✅ | Troca de professores entre filiais aprovada pelo gestor. |
