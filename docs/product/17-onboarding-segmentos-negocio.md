# 17 — Onboarding de 1º Acesso e Presets por Segmento de Negócio

> **Status:** Planejado / Refinado (Pronto para implementação futura)
> **Data:** 26/09/2026

---

## Decisão

Adotar uma arquitetura de **Configuração Inicial no 1º Login (`Business Setup Wizard`)** combinada com **Presets de Segmento (`businessSegments`)**:

1. **Landing Page enxuta (alta conversão):** O cadastro inicial na Landing Page coleta apenas dados de conta básicos (Nome, E-mail, WhatsApp e Senha).
2. **Tela de Configuração no 1º Login (`onboardingCompleted === false`):**
   - **Etapa 1 — Modelo Operacional (`operationalModel`):** O proprietário escolhe como atende seus clientes (`classes` — Turmas e Horários Fixos vs. `schedule` — Hora Marcada / Agendamento Individual).
   - **Etapa 2 — Segmentos de Atuação (`businessSegments: BusinessSegment[]`):** Seleção múltipla de 1 ou mais nichos compatíveis com o modelo operacional escolhido (ex.: `martial_arts`, `aquatics_sports`, `fitness_wellness`, `education`, `dance_arts`).
   - **Etapa 3 — Pré-criação de Modalidades/Serviços em 1 Clique:** Com base nos segmentos marcados na Etapa 2, a tela já exibe chips selecionáveis das principais modalidades do segmento (ex.: `[✓ Jiu-Jitsu]`, `[✓ Muay Thai]`, `[ ] Judô`, `[✓ Natação Infantil]`). Ao clicar em **"Concluir e acessar o painel"**, o sistema já cria automaticamente as modalidades marcadas com suas respectivas trilhas de graduação/níveis configuradas.
3. **Reconfigurável a qualquer momento:** Os segmentos do negócio podem ser alterados posteriormente em **Configurações → Dados do Negócio** sem perda de dados.

---

## Contexto

No GestaraHub, um mesmo Modelo Operacional (como o **Modelo 3 — Turmas**) atende negócios com vocabulários e rituais pedagógicos diferentes:
- Uma **Academia de Lutas** trabalha com *Jiu-Jitsu, Muay Thai, Judô*, faixas de kimono, kruangs, pontas bicolores e graus.
- Um **Centro Aquático / Esportivo** trabalha com *Natação Infantil/Adulto, Hidroginástica*, níveis por cor de touca ou etapas técnicas.
- Uma **Escola de Idiomas / Música** trabalha com *Inglês, Espanhol, Violão*, módulos (`A1 → C2`) e avaliações de conversação/gramática.
- Um **Estúdio de Pilates / Funcional** trabalha com turmas recorrentes sem necessariamente utilizar faixas de graduação (`progressionTrack.enabled = false` ou níveis `Iniciante → Avançado`).
- Além disso, existem **academias e clubes mistos** que oferecem mais de uma arte marcial (ex.: Jiu-Jitsu + Muay Thai + Boxe) ou combinam lutas com outras áreas (ex.: Lutas + Natação + Funcional).

Como a trilha de evolução (`Category.progressionTrack`) e a progressão do aluno (`Client.modalityProgressions`) já pertencem a **cada Modalidade individualmente** (e não globalmente à organização), o motor do sistema já suporta múltiplas modalidades heterogêneas na mesma conta sem necessidade de regras complexas no banco de dados. A camada de `businessSegments` atua exclusivamente como **preset inteligente de UX** (labels, chips de sugestão, templates padrão e tags de avaliação).

---

## Escopo e Arquitetura

### 1. Evolução de Contratos (`@gestarahub/contracts`)

Em `packages/contracts/src/organization.ts` (ou contrato de configuração da unidade/organização):

```ts
export type ClassesBusinessSegment =
  | "martial_arts"      // Academias de Lutas e Artes Marciais
  | "fitness_wellness"  // Pilates, Yoga, Cross e Funcional
  | "aquatics_sports"   // Natação, Hidroginástica e Esportes
  | "education_courses" // Idiomas, Música e Cursos Livres
  | "dance_arts";       // Dança, Ballet e Artes

export type ScheduleBusinessSegment =
  | "barbershop"        // Barbearia
  | "beauty_salon"      // Salão de Beleza e Esmalteria
  | "aesthetics_spa"    // Estética e Spa
  | "health_clinic"     // Clínica, Fisioterapia, Terapia
  | "general_services"; // Outros Serviços por Hora

export type BusinessSegment =
  | ClassesBusinessSegment
  | ScheduleBusinessSegment;

export interface OrganizationSettings {
  operationalModel: OperationalModel;
  businessSegments: BusinessSegment[];
  onboardingCompleted: boolean;
}
```

---

### 2. Matriz de Presets por Segmento (Modelo Turmas — `classes`)

Arquivo central planejado: `apps/web/src/lib/business-segment-presets.ts`.

| Propriedade do Preset | 🥋 `martial_arts` (Artes Marciais) | 🧘 `fitness_wellness` (Pilates / Fitness) | 🏊 `aquatics_sports` (Natação / Esportes) | 🎓 `education_courses` (Idiomas / Cursos) |
| :--- | :--- | :--- | :--- | :--- |
| **Nome Exibido** | Academia de Lutas / Artes Marciais | Pilates, Cross e Funcional | Natação e Esportes | Idiomas, Música e Cursos |
| **Sugestões de Modalidades (Chips)** | `Jiu-Jitsu`, `No-Gi / Submission`, `Muay Thai`, `Boxe`, `Judô`, `Karatê`, `Kickboxing`, `Taekwondo`, `Capoeira`, `MMA`, `Wrestling`, `Krav Maga` | `Pilates Aparelhos`, `Pilates Solo`, `Funcional`, `CrossTraining`, `Yoga`, `Mobilidade`, `Calistenia` | `Natação Infantil`, `Natação Adulto`, `Hidroginástica`, `Beach Tennis`, `Futsal`, `Vôlei` | `Inglês`, `Espanhol`, `Francês`, `Violão`, `Teclado`, `Canto`, `Bateria`, `Robótica` |
| **Trilha de Graduação ao Criar** | **Ativada por padrão** (`bjj_adult`, `judo_karate`, `muay_thai` ou `Capoeira`) | **Desativada por padrão** (ou `general_levels` opcional) | **Ativada por padrão** (`Adaptação → Iniciação → Aperfeiçoamento → Avançado`) | **Ativada por padrão** (`Básico A1 → A2 → B1 → B2 → C1 → Fluente`) |
| **Estilo Visual (`BeltBadge`)** | Desenho de **Faixa / Kruang / Corda** com até 2 cores (1ª Faixa + 2ª Ponta) e graus | Badge limpa de **Nível** (`● Intermediário • 2ª etapa`) | Badge de **Cor da Touca / Nível** (`● Touca Amarela`) | Badge limpa de **Módulo** (`● Módulo B1 • 2ª etapa`) |
| **Tags de Avaliação (`StudentProgressDialog`)** | *Guarda fechada, Passagem de guarda, Raspagem, Defesa de finalização, Condicionamento / Gás, Quedas* | *Postura, Controle de core, Flexibilidade, Respiração, Mobilidade articular, Força* | *Respiração, Pernada, Braçada, Flutuação, Mergulho, Resistência* | *Conversação, Compreensão (Listening), Gramática, Vocabulário, Pronúncia, Participação* |
| **Exemplos de Nome de Turma** | *"Ex.: Jiu-Jitsu Adulto 19h, Jiu-Jitsu Kids 07–10 anos"* | *"Ex.: Pilates 08h, Funcional Noite"* | *"Ex.: Natação Infantil 09h, Hidroginástica"* | *"Ex.: Inglês Teen Ter/Qui 14h"* |

> **Composição para Academias Mistas (Multi-Segmento):**
> Quando `businessSegments` contém mais de um segmento (ex.: `["martial_arts", "aquatics_sports"]`), o helper `getMergedSegmentPreset(segments)` concatena sem duplicatas a lista de chips sugeridos e tags de avaliação, priorizando na ordem escolhida pelo usuário. No modal de **Nova Modalidade**, também permanece disponível um botão discreto **`+ Ver outras áreas`** para permitir criar uma modalidade de outro ramo a qualquer momento.

---

## Plano de Implementação Passo a Passo

### Fase 1 — Contratos e Dicionário de Presets
1. Adicionar `BusinessSegment` e `onboardingCompleted` ao contrato de organização/tenant em `@gestarahub/contracts` e no `mocks/store.ts`.
2. Criar `apps/web/src/lib/business-segment-presets.ts` contendo a definição de `SEGMENT_PRESETS` e o helper `getMergedSegmentPreset(segments)` integrado ao `inferDefaultTrackForModalityName`.

### Fase 2 — Wizard de Configuração Inicial (1º Login)
1. Criar a rota/modal de primeiro acesso (`apps/web/src/features/onboarding/components/business-setup-wizard.tsx`) exibida quando `onboardingCompleted === false`:
   - **Bloco 1:** Seleção de Modelo Operacional (`Turmas e Horários Fixos` vs. `Hora Marcada / Agendamento`).
   - **Bloco 2:** Cards multi-seleção de `BusinessSegment` filtrados pelo modelo escolhido.
   - **Bloco 3:** Checkboxes das modalidades sugeridas (já trazendo marcadas as mais comuns do segmento, ex.: `Jiu-Jitsu` para Lutas).
2. No submit do Wizard (`completeOnboardingSetup`):
   - Salvar `operationalModel`, `businessSegments` e `onboardingCompleted = true`.
   - Disparar a criação em lote (`categoriesService.createMany` / loop de criação) das modalidades marcadas, já populadas com `inferDefaultTrackForModalityName(name)`.
   - Redirecionar para o Dashboard já com a etapa de Modalidades concluída no guia de primeiros passos do topo.

### Fase 3 — Ajustes Obrigatórios dentro de Modalidades e Checklist de Primeiros Passos

Como o Wizard de 1º Acesso **já cria as modalidades padrão** de acordo com o que o dono selecionou na configuração inicial, o módulo de **Modalidades** (`ModalidadesDialog`, `ModalityForm` e `progression-tracks.ts`) e a **Barra de Primeiros Passos (Topo)** precisarão dos seguintes ajustes:

1. **Modalidades já nascem cadastradas (Modo Revisão / Ajuste Fino):**
   - Ao concluir a tela de configuração inicial, as modalidades escolhidas (ex.: `Jiu-Jitsu` e `Muay Thai`) já são gravadas no banco com suas respectivas trilhas padrão (`bjj_adult`, `muay_thai`, etc.).
   - Na **Barra de Primeiros Passos do Topo (`SetupChecklist`)**, o passo **"1. Modalidades"** já nasce marcado como **Concluído (`✓`)**, avançando o foco automático do usuário para o próximo passo (**Equipe / Professores** ou **Turmas**), mas permitindo clicar em **"Modalidades"** caso ele queira **ajustar** as metas (ex.: mudar de `30 aulas` para `40 aulas` ou editar uma faixa).
   - Dentro da listagem de `Gerenciar Modalidades`, podemos exibir um aviso sutil ou badge nas modalidades recém-criadas pelo setup (*"Criada com a trilha padrão — clique em editar se quiser personalizar metas ou faixas"*).

2. **Filtro Inteligente nos Chips de `Sugestões:` dentro do `ModalityForm`:**
   - Os chips de sugestão rápida (`+ Jiu-Jitsu`, `+ Muay Thai`, `+ Natação Infantil`, etc.) devem:
     - Vir **100% dinâmicos** a partir dos segmentos selecionados na configuração do negócio (`getMergedSegmentPreset(org.businessSegments)`), em vez de uma constante estática `QUICK_MODALITY_SUGGESTIONS` fixa de lutas.
     - **Ocultar (ou marcar como "Já cadastrada")** as modalidades que **já foram criadas** na tela inicial de configuração! Por exemplo: se o dono já marcou `Jiu-Jitsu` e `Muay Thai` no onboarding, quando ele clicar em **`+ Nova modalidade`** no futuro, as sugestões mostrarão primeiro as que ele **ainda não tem** (`+ No-Gi / Submission`, `+ Boxe`, `+ Judô`...).

3. **Template Inicial e Lista de Templates (`PROGRESSION_TEMPLATES`) adaptados ao Segmento:**
   - Hoje o `ModalityForm` inicia sempre com `PROGRESSION_TEMPLATES.bjj_adult.track` (`enabled: true`).
   - Com a tela de configuração:
     - Se o negócio for **`martial_arts`**, uma nova modalidade abre com `enabled: true` e template de Faixas.
     - Se o negócio for **`fitness_wellness`** (Pilates/Funcional), uma nova modalidade abre com `enabled: false` por padrão (ou template `Níveis Gerais: Iniciante → Avançado`), sem exibir termos de "Faixa/Kimono".
     - Se o negócio for **`aquatics_sports`** (Natação) ou **`education_courses`** (Idiomas), `PROGRESSION_TEMPLATES` incluirá os templates dedicados (`Natação: Adaptação → Avançado (Toucas)` e `Idiomas/Cursos: Básico A1 → Fluente`) e já selecionará o template do segmento por padrão.

4. **Modal de Evolução do Aluno (`StudentProgressDialog`) e Configurações:**
   - **Evolução do Aluno:** Alimentar as sugestões de tags de *Pontos fortes* e *Pontos de atenção* de acordo com o segmento da modalidade (ex.: *Guarda fechada / Passagem* para Lutas vs. *Respiração / Pernada* para Natação vs. *Conversação / Gramática* para Idiomas).
   - **Configurações → Dados do Negócio:** Adicionar a seção **"Segmento de atuação"** permitindo alterar os segmentos e recarregar os presets de sugestões a qualquer momento.

---

## Alternativas Rejeitadas

1. **Perguntar modelo, segmento e modalidades direto no formulário da Landing Page:**
   - *Por que foi rejeitada:* Formulários longos na Landing Page reduzem drasticamente a taxa de conversão de novos cadastros. Coletar apenas credenciais na Landing Page e apresentar o Wizard visual nos primeiros 20 segundos pós-login gera maior engajamento e já entrega o sistema pré-populado.
2. **Travar uma única regra de graduação global na Organização inteira:**
   - *Por que foi rejeitada:* Impediria que uma academia tivesse Jiu-Jitsu (faixas + 4 graus), Muay Thai (kruangs sem graus), Boxe (sem faixa) e Natação (níveis/toucas) na mesma conta. Manter `progressionTrack` por modalidade (`Category`) garante suporte nativo a múltiplas lutas e múltiplas modalidades sem *overengineering*.
