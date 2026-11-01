# 07. Padrões Técnicos de Telas, Formulários, Modais e Mobile UX

> **Documento obrigatório para engenheiros e agentes de IA (Claude Code, Antigravity, Cursor).**
> Este guia consolida a anatomia exata das telas, listagens, modais de formulário, microcopy (`pt-BR`) e regras de responsividade mobile (iOS Safari & Chrome) do GestaraHub. Qualquer nova tela ou alteração em telas existentes **deve** seguir estes padrões.

---

## 1. Anatomia Padrão de uma Tela de Módulo (`*-view.tsx`)

Toda tela principal de módulo (ex.: `Turmas`, `Alunos`, `Financeiro`, `Equipe`, `Planos`, `Modalidades`) segue uma hierarquia visual estrita de cima para baixo:

### 1.1. `PageHeader` e Ação Principal (`+ Novo ...`)
- O botão primário de criação (`+ Nova turma`, `+ Novo aluno`, `+ Novo lançamento`, `+ Novo plano`) fica **sempre no canto superior direito do `PageHeader`**.
- **Proibido** esconder a ação principal dentro de uma aba secundária ou duplicá-la na barra de filtros quando ela pertence ao módulo inteiro (ex.: em `Financeiro`, `+ Novo lançamento` fica no `PageHeader` de `finance-view.tsx` e permanece visível tanto em `Resumo` quanto em `Lançamentos`).
- Ao submeter um registro criado a partir de outra aba (ex.: criar lançamento estando na aba `Resumo`), navegue automaticamente para a aba onde o registro aparece (`setTab("entries")`).

### 1.2. Cards de KPI / Resumo no Topo
- **Limite máximo de 4 cards** na mesma linha (`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`).
- Se houver informações secundárias (como subtotais, pendentes ou contadores auxiliares), agrupe-as como **subtexto (`sub`)** dentro dos 4 cards principais em vez de criar 5 ou 6 cards estreitos.
- **Nunca trunque (`truncate`) valores monetários ou nomes de categorias** em cards ou barras de proporção; use `flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5` com `shrink-0 tabular-nums` no valor à direita.

### 1.3. Barra de Filtros (`Toolbar`) + `ListSummaryBar`
Toda aba ou tela de listagem deve conter:
1. **Barra de busca e filtros**:
   - `SearchInput` (`@/components/shared/list`) com placeholder direto (`"Buscar aluno por nome, telefone ou e-mail..."`, `"Buscar professor..."`, `"Buscar por descrição ou observação..."`).
   - Filtros de escopo (`StatusFilterSelect`, `Select` de categoria/modalidade, `SegmentedChoiceField` para 2–3 opções curtas).
   - `ViewModeToggle` (`@/components/shared/list`) quando a entidade suporta alternância **Lista / Cartões** (nunca "Cards" na tela).
2. **`ListSummaryBar` logo abaixo dos filtros**:
   - Sempre renderizar `<ListSummaryBar>` entre a barra de filtros e a `<ListContainer>` (ou grid de cards).
   - Passar obrigatoriamente `isLoading={isPending}` para exibir o skeleton com a mesma altura do contador (`"8 alunos cadastrados"`, `"3 professores ativos"`) e evitar *layout shift* vertical quando a query resolve.

```tsx
<ListSummaryBar
  count={filtered.length}
  totalCount={allItems.length}
  singular="lançamento"
  plural="lançamentos"
  isFiltered={isFiltered}
  onClearFilters={resetFilters}
  isLoading={isPending}
/>
```

**Paginação (30/10/2026, a pedido):** a `PaginationBar` fica só embaixo da lista, logo depois da `ListContainer`, sem repetir no topo (o total já está na `ListSummaryBar`). Trocar de página ou de quantidade por página leva a tela ao início do bloco da lista (o pai da barra, com a busca e os filtros), abaixo do topo fixo, só quando esse início já saiu da tela (`scrollToListStart`, `components/shared/list/list-scroll.ts`). Por isso a barra precisa ficar dentro do mesmo bloco da busca e da lista.

### 1.4. Linhas de Listagem (`ListRow`) e Menus de Ação (`⋮` + Botão Direito)
- Toda linha (`ListRow`) ou card de listagem deve oferecer as mesmas ações via:
  1. **`ListItemContextMenu`** envolvendo o elemento da linha/card (abre com clique direito no desktop ou toque longo no mobile).
  2. **`ListItemActionsMenu`** (`⋮`) posicionado no canto direito da linha/card.
- **Ordem padrão dos itens no menu (`ActionMenuItem[]`)**:
  1. Ações primárias de visualização/operação (ex.: `"Ver detalhes"`, `"Registrar pagamento"`, `"Lista de chamada"`).
  2. `"Editar"` (ícone `Pencil`).
  3. Ações de ciclo de vida separadas por `separator: true`: `"Inativar"` / `"Reativar"` (`Power`) ou `"Cancelar"` / `"Excluir"` (`Trash2`, `variant: "destructive"`).

**Lista de Alunos sem cobrança (30/10/2026, a pedido):** a linha e o cartão mostram nome, situação, termo pendente, evolução e contato. Plano, bolsa, pausa e pacote ficam na ficha do aluno.

### 1.5. Altura dos Botões: uma só (17/10/2026)
- **Botão com texto usa sempre a altura padrão do `Button` (36px).** Não passe `size="sm"`, `size="xs"` nem `size="lg"`, e não coloque altura no `className` (`h-*`, `min-h-*`, `py-*`). Vale para o app inteiro, a landing page, o banner de cookies e os diálogos.
- **Botão só de ícone** usa `size="icon"` (os mesmos 36px), principalmente ao lado de botões com texto (setas do calendário e do mês, alternar tema, menu lateral).
- Exceções, só por variante e nunca por `className`: `size="icon-sm"` (32px) nas ações dentro de linhas e cards (o `⋮`, desfazer pagamento, remover item de uma lista) e `size="icon-xs"` (24px) no "x" de remover dentro de chips, arquivos e anexos.
- Campo ao lado de um botão segue a altura padrão do campo (sem `h-*`), para os dois ficarem alinhados.

### 1.6. Exceção: telas de turma e de aula (18/10/2026)
As telas de detalhe da turma (`/classes/[id]`) e da aula (`/classes/sessions/[id]`) seguem uma versão mínima, aprovada para não pesar no celular (regras de produto no doc [11](../product/11-modelo-3-turmas.md), "Telas de turma e de aula"):
- **Sem avatar** nas linhas de aluno; nível em texto (faixa mantém o selo colorido).
- **Busca só a partir de 9 alunos** e **sem `ListSummaryBar`**: o cabeçalho já diz as vagas.
- **Ações raras no menu ⋮ do cabeçalho** (`PageActionsMenu`, `@/components/shared/page-actions-menu`, botão `size="icon"` ao lado do principal); seleção em lote só quando pedida nesse menu, com barra fixa embaixo.
- **Chamada por toque na linha** (sem os três botões Presente / Faltou / Justificada) e uma ação por vez numa barra fixa embaixo ("Concluir chamada", depois "Registrar a aula").
- Linha mostra só o que pede atenção (alertas), não dados de cadastro (telefone, data de matrícula).

### 1.7. "‹ Voltar" nas telas de detalhe (18/10/2026)
- Ficha do aluno, turma e aula usam **`BackLink`** (`@/components/shared/back-link`): o texto é sempre **"Voltar"** e ele volta para a tela anterior do app (ex.: da aula para a ficha e de volta para a aula). Aberta direto ou recarregada, vai para o destino padrão da tela (`fallbackHref`: lista de alunos, turmas, calendário da semana da aula).
- As rotas visitadas ficam em `lib/navigation-history` (anotadas pelo `NavigationTracker` no layout do app). Ctrl/Cmd/Shift abre o destino padrão em outra aba.
- O link fica dentro de um `<nav>`: o Next foca o primeiro elemento da página ao navegar, e assim o link não aparece com a moldura de foco. Tela nova de detalhe usa o mesmo componente.

### 1.8. Ficha do aluno: avisos e sanfona (18/10/2026)
Layout aprovado na prévia ("B refinado", versão Sanfona) para a ficha (`/clients/[id]`, `student-profile-view.tsx`):
- **Topo só com nome e situação** (avatar, nome, selo). Contato, idade e "aluno desde" ficam no **Cadastro**; o plano, em **Plano e pacotes**; nada disso se repete no topo. "Editar" (escondido no celular) e o ⋮ (`PageActionsMenu`) com "Editar cadastro", "Enviar WhatsApp", "Nova cobrança", "Vender pacote", "Inativar"/"Reativar".
- **Avisos** (`student-profile-alerts.tsx`): um cartão por assunto, só quando há algo a fazer; o atraso em vermelho (`border-red-500/30 bg-red-500/5`), os outros neutros. Sem bolinhas nem pontos de alerta nas seções.
- **Sanfona em vez de abas**: uma lista com borda, uma linha por seção (título + resumo de uma linha + seta), fechadas por padrão; `?tab=<id>` abre uma. Cada seção abre o painel completo que já existia. Sem cartões de KPI: os números viram os resumos ("3 em aberto · R$ 270,00 · 1 atrasada").
- **Plano e pacotes (30/10/2026, a pedido):** seção logo abaixo de Turmas, só para quem vê cobranças (`billing:view`). O resumo fica em destaque (texto normal, não cinza): "Plano Inicial · R$ 130,00/mês · vence dia 27", "Pacote 10 aulas · 8 aulas restantes", "Bolsista integral" ou "Sem mensalidade". Aberta (`student-plan-panel.tsx`): nome do plano e valor grandes, a linha de situação, vencimento, pagamento e Pix Automático com "Trocar plano" (abre o cadastro), a bolsa e os pacotes (`StudentPackagesPanel` compacto: em uso com a barra do saldo, encerrados em "Mostrar encerrados", renovar e cancelar no ⋮). Substituiu a seção "Pacotes" e o cartão "Mensalidade" do Cadastro; `?tab=packages` abre ela.
- **Cadastro sem cartões (30/10/2026, a pedido):** grade de até 3 colunas, sem título repetido nem segundo "Editar", só os campos preenchidos; o que falta vira "Falta e-mail e nascimento · Completar cadastro". Responsáveis na grade (sempre para menor). Menor de idade mostra a autorização LGPD com "Registrar termo impresso" e "Baixar termo"; enviar e copiar o link ficam no aviso do topo.

---

## 2. Anatomia Padrão de Modais de Formulário (`Dialog`)

### 2.1. Estrutura Flexbox com Cabeçalho e Rodapé Fixos (`shrink-0`)
Todo modal de formulário (`*-form.tsx` / `*-dialog.tsx`) deve dividir a estrutura em 3 regiões para que o cabeçalho e o rodapé nunca rolem junto com os campos:

1. **`DialogContent`**: `className="sm:max-w-lg max-h-[88vh] flex flex-col p-0 overflow-hidden"`, com `expandable` e `storageKey="<modulo>-form"` nos formulários médios/grandes.
2. **`DialogHeader`**: `className="p-6 pb-2 pr-20 shrink-0"` (reserva espaço à direita para o botão `X` e o botão expandir).
3. **`<form>` + `DialogBody` + `DialogFormFooter`**:
   - O `<form>` recebe `className="flex flex-col min-h-0 flex-1 overflow-hidden"`.
   - Os campos ficam dentro de `<DialogBody className="space-y-4">` (que gerencia o `overflow-y-auto`, padding `px-6 py-3` e o indicador de rolagem, um pill flutuante ⌄).
   - O rodapé fica fora do `DialogBody`, com `shrink-0 border-t border-border/40 p-6 pt-4 bg-background`.

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent
    className="sm:max-w-lg max-h-[88vh] flex flex-col p-0 overflow-hidden"
    expandable
    storageKey="entity-form"
  >
    <DialogHeader className="p-6 pb-2 pr-20 shrink-0">
      <DialogTitle>{isEdit ? "Editar registro" : "Novo registro"}</DialogTitle>
      <DialogDescription>
        Preencha os dados abaixo.
      </DialogDescription>
    </DialogHeader>

    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col min-h-0 flex-1 overflow-hidden"
      >
        <DialogBody className="space-y-4">
          {/* Campos do formulario aqui */}
        </DialogBody>

        <DialogFormFooter
          isPending={pending}
          isEdit={isEdit}
          className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background"
        />
      </form>
    </FormProvider>
  </DialogContent>
</Dialog>
```

### 2.2. Padrão Único de Botões do Rodapé (`Adicionar`, `Salvar`, `Cancelar`)
Todos os modais de cadastro e edição usam **exclusivamente** este trio de labels (padrão do componente `DialogFormFooter` em `@/components/form/dialog-form-footer.tsx`):
- **Modo Criação (`!isEdit`)**: `"Adicionar"` (durante submit: `"Salvando..."`)
- **Modo Edição (`isEdit`)**: `"Salvar"` (durante submit: `"Salvando..."`)
- **Botão secundário (fechar)**: `"Cancelar"` (`variant="outline"`)

> **Não criar variações** como `"Criar profissional"`, `"Criar turma"`, `"Cadastrar aluno"`, `"Salvar alterações"` ou `"Lançar"`. O título do modal (`Novo aluno`, `Nova turma`, `Novo lançamento`) já explicita a entidade; o botão de ação deve ser curto, previsível e caber lado a lado no mobile sem truncar.

### 2.3. Placeholders e Microcopy (`pt-BR`)
- **PROIBIDO usar `"Ex.: ..."`** em placeholders de `<InputText>`, `<TextArea>` ou `<SearchInput>`.
  - ❌ Errado: `placeholder="Ex.: Jiu-Jitsu, Muay Thai..."`, `placeholder="Ex.: Conta de luz — abril"`, `placeholder="Ex.: faixa azul 2 graus"`
  - ✅ Correto: `placeholder="Informe o nome da modalidade"`, `placeholder="Descreva o lançamento"`, `placeholder="Informe observações adicionais (opcional)"`
- Quando quiser oferecer exemplos clicáveis para acelerar o preenchimento (como em `Modalidades`), use **chips de sugestão clicáveis** (`+ Jiu-Jitsu`, `+ Muay Thai`) abaixo do input no modo de criação (`!isEdit`), nunca dentro do `placeholder`.

### 2.4. Gerenciamento Inline de Entidades Auxiliares (ex.: Categorias)
- Quando um campo `<SelectField>` depende de uma tabela auxiliar que o usuário pode cadastrar (como Categorias Financeiras em `finance-entry-form-dialog.tsx`), coloque um link de ação **`+ Gerenciar categorias`** alinhado à direita do `label` do próprio campo (`flex items-center justify-between`):
  ```tsx
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label htmlFor="entry-category" className="text-sm font-medium leading-none">
        Categoria <span className="text-destructive">*</span>
      </label>
      <button
        type="button"
        onClick={() => setCategoriesOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="size-3" />
        Gerenciar categorias
      </button>
    </div>
    <SelectField<FormValues> id="entry-category" name="categoryId" ... />
  </div>
  ```
- Isso abre um modal empilhado (`FinancialCategoryManagerDialog`) sem fazer o usuário perder o preenchimento do formulário atual.

### 2.5. Anexo de Arquivos (`FileDropField`)
- Use `FileDropField` (`@/components/form`) para anexar um ou mais arquivos: área de arrastar e soltar (ou clicar; no celular, "Toque para escolher"), lista com miniatura da imagem, tipo (`PDF`, `PNG`), tamanho e botão de remover. O valor no RHF é `File[]` (padrão `[]`), com `name`, `type` (MIME) e `size` de cada arquivo.
- As regras (`accept` com MIME exato, curinga `image/*` ou extensão `.pdf`; `maxSizeBytes`; `maxFiles`; `acceptLabel`) vão no campo **e** no schema: `filesSchema(regras)` de `@/lib/files`, para a lista marcar em vermelho o mesmo arquivo que o Zod recusa. Arquivo repetido (mesmo nome, tamanho e data) não duplica. Fora de formulário, use `FileDropzone` (controlado por `value`/`onChange`).
- Comprovante de pagamento: `RECEIPT_FILE_RULES` (imagem ou PDF, até 10 MB cada, no máximo 5), já aplicado no `PaymentDialog`. Por enquanto os arquivos não são enviados (ver `docs/technical/05-modulo-financeiro.md`, seção 10).

---

### 2.6. Nada muda enquanto o diálogo fecha (21/10/2026)

`Dialog`, `Sheet` e `AlertDialog` saem com animação (200 a 500 ms). Trocar o conteúdo ou resetar estado no `onOpenChange(false)` faz a tela piscar nesse intervalo: o título some, o formulário volta ao início, a lista perde o filtro. Regras:

- **Entidade que abre o diálogo** (`open={x !== null}` ou `open={Boolean(x)}`): o `open` usa o valor atual e o conteúdo usa o retido, `const x = useRetainedValue(xProp)` (`lib/use-retained-value.ts`). Nunca `if (!x) return null` com o valor cru.
- **Conteúdo montado só quando aberto** (`{open ? <Form /> : null}`, para o formulário recomeçar a cada abertura): use `const present = useDialogPresence(open)` e `{present ? <Form /> : null}` (`lib/use-dialog-presence.ts`). O conteúdo fica até o fim da animação; a `key` continua reiniciando o formulário.
- **Reset de estado interno** (busca, método escolhido, motivo, aba técnica): `useAfterDialogClose(open, reset)` em vez de resetar dentro do `onOpenChange`. Roda depois da animação; se reabrir antes, roda na hora.
- Formulários em `Sheet` que precisam reter a entidade e reiniciar por abertura já usam o estado `shown` com `session` (ex.: `sell-package-dialog.tsx`); vale igual.

Aplicado em 21/10/2026 em: detalhe e remarcação do agendamento, detalhe da auditoria, graduação, registros e notas do aluno, registrar a aula, avaliação e lançar notas, substituição de instrutor, nova mensagem, editar modelo, detalhe da mensagem, checkout da assinatura, cobrar online, matricular alunos, cancelar cobrança e inativar aluno.

### 2.7. Formulário em drawer: rodapé sempre no fim (22/10/2026)

Formulário de cadastro e edição abre em drawer (`Sheet` à direita). O rodapé fica preso no fim do drawer, mesmo com poucos campos; nunca logo abaixo dos inputs.
- `SheetContent` com `flex h-full flex-col gap-0 overflow-hidden p-0`; o `<form>` é filho direto, com `flex min-h-0 flex-1 flex-col overflow-hidden`.
- Campos dentro de `<DialogBody className="space-y-4">` (só eles rolam).
- Rodapé (`DialogFormFooter` ou `DialogFooter`) com `shrink-0 border-t border-border/40 bg-background p-6 pt-4`, fora do `DialogBody`.
- Nunca envolver o formulário num `div` com `flex-1 overflow-y-auto`: o rodapé passa a rolar junto e fica colado nos campos.
- Exemplos: `sell-package-dialog.tsx`, `plan-form.tsx`, `components/shared/payment-dialog.tsx`.
- Em 22/10/2026 também viraram drawer: matricular da lista de espera (curso), editar mensagem automática, ativar conta de recebimento, transferir saldo (Pix), pagamento do mês do professor e nova série recorrente. Em 31/10/2026, adicionar aluno na aula (avulsa, pacote ou experimental): tipos um por linha com marcador, valor da avulsa como linha só de leitura (vem da turma). Também em 31/10/2026, trocar o instrutor da aula (resumo da aula, substituto, motivo; "Restaurar titular" no rodapé quando há substituto). Continuam modal: ações de um ou dois campos, janelas empilhadas sobre um drawer (gerenciar categorias, termos de intermediação, nova meta), fluxos guiados e telas só de leitura.

## 3. Usabilidade Mobile (iOS Safari & iOS/Android Chrome)

O GestaraHub é utilizado diariamente pelo celular no tatame/recepção. As seguintes regras técnicas evitam bugs clássicos de WebKit / WKWebView (Chrome e Safari no iOS):

### 3.1. Proibido Fonte `< 16px` em Inputs no Mobile (Prevenção de Auto-Zoom iOS)
- No iOS (Safari e Chrome), focar qualquer `<input>`, `<textarea>` ou `<CommandInput>` com `font-size < 16px` (`text-sm` = `14px`) dispara um **zoom automático na página inteira** que desalinha modais e popovers.
- **Regra obrigatória**: Todo componente de entrada de texto (`components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/command.tsx`) deve usar `text-base md:text-sm` (`16px` em telas `< 768px`, `14px` a partir de `md`). Nunca sobrescreva um `<input>` com `className="text-xs"` ou `className="text-sm"` sem o prefixo `md:`.

### 3.2. Sem Auto-Focus em Dispositivos Touch (`pointer: coarse`) e Campos `date`/`time`
- **Modais (`DialogContent`)**: `components/ui/dialog.tsx` intercepta `onOpenAutoFocus` e chama `event.preventDefault()` quando:
  1. O dispositivo é touch (`window.matchMedia("(pointer: coarse)").matches`), **ou**
  2. O primeiro campo focável do formulário é `type="date"` ou `type="time"`.
  - Isso impede que a abertura de um modal no celular dispare imediatamente o teclado virtual ou o seletor nativo de data/hora do iOS/Android antes de o usuário ler o formulário.
- **Popovers de Seleção (`Combobox` e `MultiSelectField`)**:
  - Ao abrir o popover no mobile (`pointer: coarse`), **não** focar automaticamente o `CommandInput` (para que a lista de opções apareça inteira sem ser coberta pelo teclado). Se o usuário quiser filtrar, ele toca no campo de busca.
  - No `MultiSelectField` (`components/form/multi-select-field.tsx`), selecionar uma opção em dispositivo touch fecha o popover automaticamente (`setOpen(false)`).

### 3.3. Altura de Modal Travada em Pixels no Mobile (`mobileMaxHeightPx`)
- **Por que não usar apenas `max-h-[90vh]` ou `dvh` no mobile?**
  No Google Chrome para iOS (`WKWebView`), quando o teclado virtual sobe, o navegador encolhe a unidade `vh` para a área restante acima do teclado (`~380px`). Como o modal já tem cabeçalho (`~80px`) e rodapé (`~72px`), o `DialogBody` fica espremido em menos de `150px` e deslocado para o topo da tela.
- **Solução implementada em `components/ui/dialog.tsx`**:
  `DialogContent` mede `Math.round(window.screen.height * 0.78)` em pixels fixos (`mobileMaxHeightPx`) e aplica via `style={{ maxHeight: "${mobileMaxHeightPx}px" }}` no mobile. Assim, o tamanho do modal permanece constante quando o teclado abre no Chrome iOS (idêntico ao comportamento nativo do Safari).

### 3.4. Indicador de rolagem (pill ⌄) e Rodapé de 2 Colunas no Mobile
- O indicador de rolagem do `DialogBody` é um **botão redondo flutuante com a seta ↓, sem animação** (21/10/2026, a pedido; antes era uma barra com o texto "Mais campos abaixo"), centralizado na base da área rolável, com um esmaecido por trás. O texto (`scrollCueLabel`) fica no `aria-label` e no `title`. Some no fim da rolagem e enquanto um input está focado no celular (`isMobileInputFocused`), por isso não fica por cima do campo em que se digita.
- O `DialogFooter` posiciona `Cancelar` e `Adicionar`/`Salvar` **lado a lado em 2 colunas no mobile** (`grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end`), economizando `~48px` de altura vertical.

### 3.5. `crypto.randomUUID()` em Redes Locais (`http://192.168.x.x`)
- Ao testar o app pelo celular via IP da rede local (`http://192.168.1.x:3000`), os navegadores mobile classificam a página como contexto não-seguro (`window.isSecureContext === false`) e deixam `crypto.randomUUID` como `undefined` (embora `crypto.getRandomValues` continue disponível).
- **Regra**: Nunca chame `crypto.randomUUID()` diretamente no código da aplicação ou dos serviços; use sempre `newId(prefix)` de `@/mocks/helpers.ts`, que possui fallback UUID v4 via `crypto.getRandomValues`.

---

## 4. Animações de Destaque e Guias Contextuais

- Qualquer animação de chamada de atenção (como o pulso no botão `Continuar →` da barra de onboarding `animate-onboarding-pulse` ou no botão `Personalizar regras e níveis` em `modality-form.tsx`) deve rodar por **exatamente 2 ciclos (`3.6s`) e encerrar suavemente** (`forwards` + limpeza de estado via `setTimeout`), **nunca** em loop infinito (`infinite`).

## Telefone com país (18/10/2026)

- Todo campo de telefone usa `InputPhone`: seletor de país (bandeira e DDI, Brasil +55 primeiro) ao lado do número, máscara do país enquanto digita e "+DDI" colado troca o país sozinho.
- Guardado em E.164 (`+5511977770000`). Número antigo só com dígitos vale como Brasil. Exibição: Brasil "(11) 97777-0000", outros países no formato internacional. Validação: tamanho do país e, no Brasil, com DDD (`isPossiblePhone`). O WhatsApp usa o DDI de cada país (`whatsappDigits`).
- Registrar pagamento sempre pede "Pago em" (padrão hoje, nunca no futuro) além da forma e do comprovante.

## Ajustes da Prioridade 2 (18/10/2026)

- **Sair de Configurações com alteração não salva** pelo menu ou por qualquer link interno confirma antes ("Sair sem salvar?"), além da troca de aba (`useLeaveLinkGuard`).
- **Configuração inicial:** o passo fica na URL (`?passo=`) e o rascunho na sessão do navegador; recarregar não perde nada. Nome do espaço até 80 caracteres (também no cadastro e em Configurações). Aulas repetidas (caixa ou acento) contam uma vez. Outra área já começa com uma aula com o nome dela.
- **Topo:** nome do espaço e da unidade também no celular.
- **Modelo de mensagem:** até 900 caracteres, com contador "N de 900" (o serviço recusa acima).
- **Aluno com telefone já cadastrado:** ao criar, confirma antes mostrando quem já tem o número.
- **Aniversário:** "Mandar parabéns" só no dia; antes dele, a ficha mostra a data (dd/MM). Quem nasceu em 29/02 faz aniversário em 28/02 nos anos não bissextos, com a idade certa.
- **Voltar** desempilha só quando o navegador volta de verdade (ir para a frente não tira da pilha).
- **Matricular com turma lotada no celular:** os botões do rodapé ficam um embaixo do outro.

## Ajustes da Prioridade 3 (18/10/2026)

- **Nada de reticências em nome ou valor:** `truncate` saiu das listas, cartões e diálogos do modelo de turmas; o texto quebra a linha (`min-w-0 break-words`, e-mail com `break-all`). As notas do aluno saíram da linha da lista (ficam na ficha).
- **Campos de seleção crescem:** `SelectField` e `Combobox` usam `min-h-9` e quebram o valor longo em duas linhas. Filtros com `Select` usam `sm:w-auto sm:min-w-*` (o rótulo cabe inteiro).
- **Abas segmentadas quebram a linha** (Financeiro, Configurações, Planos, Comunicação), sem rolagem lateral escondida.
  - Revisão de celular de 31/10/2026: as quatro usam um componente só, `PageTabs` (`@/components/shared/page-tabs`). No celular as abas ocupam a largura toda, em partes iguais e sem ícone (três abas cabem numa linha); do `sm` para cima ficam do tamanho do texto, com ícone. Aba nova de tela usa `PageTabs`.
- **`PageHeader`:** no desktop as ações ficam numa linha só (`sm:shrink-0`); quem quebra é a descrição.
- **Valores do Financeiro** diminuem com a largura (`text-2xl sm:text-3xl lg:text-2xl xl:text-3xl`) e os cartões têm `min-w-0`.
- **Simulação das regras da mensalidade** vira um bloco por cobrança no celular (a tabela fica do `sm` para cima).
- **Celular:** atalhos de linha viram só ícone (`Ver em Cobranças`, `Ver professores`, `Configurar pagamento`); o cabeçalho de cartão com botão quebra a linha; pedaços curtos do cabeçalho da turma e da aula não quebram no meio.
- **Rodapé de diálogo:** sempre `DialogFooter`/`DialogFormFooter` (duas colunas no celular). "Adicionar aluno nesta aula" segue o padrão, com "Adicionar".
- **Foco:** ação do menu ⋮ que abre diálogo deixa o foco no diálogo (`keepFocusInOpenDialog`).
- **Rótulos acessíveis em português:** "Fechar", "Mais", "Abrir ou fechar o menu".
- **Contraste:** selos em verde, âmbar, azul e vermelho usam o tom 700 no claro; `--success`, `--warning` e `--info` ficam mais claros no escuro. A impressão sai sempre clara.
- **Balão do destaque** ("Comece por aqui.") vai para baixo da seção quando não cabe acima da barra do topo; cor primária.
- **Textos:** sem "&" nem "Ex.:"; títulos só com a primeira maiúscula; separador "·"; ocupação "3 de 10 alunos"; "Dashboard" virou "Painel"; nome com o tipo não repete ("Pacote Pacote", `withKind`); selo do pacote "Restam 7 de 10"; relatórios com títulos curtos e mês em português (`CompetencePicker`).
- **Pequenas UX:** seleção em lote com "Sair da seleção"; "Ver aulas no calendário" abre só a turma (`?class=`); "Sem pacote" só depois de carregar os pacotes; Mensagens da ficha sem busca nem filtro quando não há mensagem; Histórico com o filtro "Avisos"; grupos de Comunicação em sanfona (no celular só o primeiro abre); menu do celular da landing fecha com Esc e toque fora.

## Achados sem prioridade (18/10/2026)

- **Sem telefone com DDD:** sem "Lembrar no WhatsApp" na cobrança e sem "Nova mensagem" na ficha (o vazio diz para cadastrar o telefone).
- **Avisos da ficha:** botões com contorno; no celular dividem a linha.
- **Comunicação:** "Abertas no WhatsApp" conta só as abertas; taxas só no oficial; "Cobranças pagas depois de um lembrete". Variável desconhecida no modelo avisa que a frase sai.
- **Cadastro do aluno:** ano de nascimento de até 110 anos atrás; idade "menos de 1 ano"; observações até 1000 caracteres.
- **Configuração inicial:** setas e Home/End na lista de áreas; trocar de passo leva o foco ao título; "Outra área" com nome de área da lista sugere usá-la; área sem trilha não pede revisão de níveis e metas.
- **Destaque de seção** fecha os avisos (toasts) abertos.
- **Posição dos avisos (toasts):** no topo, centralizados (`<Toaster position="top-center">` em `app/layout.tsx`). Nunca no canto inferior direito: lá cobrem os botões do rodapé das janelas laterais e o "Aceitar e continuar" do contrato por alguns segundos (achados 11 e 31 do teste de 23/10).
- **Boas-vindas:** fecha só pelo X ou pelos botões (nem Esc nem clique fora).
- **Landing com sessão:** "Ir para o painel" no cabeçalho e no lugar do cadastro.
- **Dia de vencimento nas Configurações:** o erro sai numa linha própria.
- **Limite de texto da mensagem:** "Nova mensagem" (1000) e modelo (900) com contador "N de M"; emoji conta 1 caractere (`charCount`, em `@/lib/text`), na tela e no serviço (ALU-38).

## Configurações (31/10/2026, decidido com o dono)

- **Abas:** Geral, Horários, Cobrança, Certificado e Plano GestaraHub (Cobrança e Certificado só no modelo de turmas). Todas com a mesma largura (`max-w-5xl`), menos o Certificado, que usa a tela toda para a prévia ficar grande (a pedido, 31/10/2026). Links antigos das regras (`/settings#billing-rules`, `?tab=geral#billing-rules`) levam à aba Cobrança.
- **Preferências de cada pessoa** (tema, cor de destaque e som) ficam só no menu da conta (avatar → Preferências), não nas Configurações do espaço.
- **Barra de salvar** (`SettingsSaveBar`, `features/settings/components/settings-save-bar.tsx`): presa embaixo da tela (respeita a barra do iPhone), aparece só com alteração não salva e some depois de salvar. Botões "Descartar" e "Salvar", sem ícone e sem variação ("Salvar configurações", "Salvar horários" saíram); no celular os dois dividem a linha. Passo da configuração inicial pendente mostra a barra mesmo sem alteração ("Falta confirmar" e "Confirmar regras recomendadas"). Como o Salvar só aparece depois de mudar algo, os guias da ajuda não apontam para ele: o passo anterior diz "Depois, salve na barra que aparece embaixo".
- **Geral:** blocos sempre abertos (`SettingsSection`), sem sanfona. Sem "Nome da unidade" até existir multiunidade. Telefone salvo inválido aparece com erro ao abrir a aba, e o serviço também confere o número (`settingsService.updateUnit`).
- **Gravação por partes:** `updateOrganization` junta `settings` com o que já está salvo; cada aba manda só as suas chaves (Geral o fuso, Cobrança as regras).
- **Certificado:** "Quem assina" escolhe entre professor da turma, nome do espaço ou outro nome (ninguém digita `{professor}` ou `{empresa}`). "Voltar ao texto padrão", no bloco Texto, volta o título e o texto no rascunho, com confirmação; quem grava é a barra.
- **Aparência:** tema (claro, escuro ou do sistema), cor de destaque (um cinza só, "Padrão") e som. Cor base, cantos, menu lateral (escuro), fonte e estilo ficam fixos no CSS (`lib/theme-accent.ts`); sem Google Fonts na política de segurança.
- **Abas segmentadas (`PageTabs`):** o contorno de foco aparece só pelo teclado.

## Relatórios: catálogo em lista (01/11/2026, decidido com o dono)

- O catálogo (`features/reports/reports-catalog-tab.tsx`) é uma lista por categoria (Operacionais, Financeiros, Retenção): uma linha por relatório (ícone, título, descrição de uma linha, chevron), a linha inteira abre (`aria-label` "Abrir {título}"). Antes eram cards grandes com botão "Abrir" de largura total e a tela rolava para 8 itens.
- Sem busca (8 itens fixos) e sem seletor de mês no catálogo: o mês se escolhe dentro do relatório aberto, no cabeçalho ao lado do título (todos os relatórios são do mês, inclusive a relação de alunos, que mostra quem já era aluno no mês).
- Os do Plano Profissional ficam no grupo deles com a etiqueta e o cadeado; a linha abre o convite ("Ver no Plano Profissional: {título}").
- Relatório aberto e convite usam o "‹ Voltar" padrão (volta ao catálogo, que é estado da mesma tela).
