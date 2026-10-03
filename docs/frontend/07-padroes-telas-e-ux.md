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
   - `ViewModeToggle` (`@/components/shared/list`) quando a entidade suporta alternância **Lista / Cards**.
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

### 1.4. Linhas de Listagem (`ListRow`) e Menus de Ação (`⋮` + Botão Direito)
- Toda linha (`ListRow`) ou card de listagem deve oferecer as mesmas ações via:
  1. **`ListItemContextMenu`** envolvendo o elemento da linha/card (abre com clique direito no desktop ou toque longo no mobile).
  2. **`ListItemActionsMenu`** (`⋮`) posicionado no canto direito da linha/card.
- **Ordem padrão dos itens no menu (`ActionMenuItem[]`)**:
  1. Ações primárias de visualização/operação (ex.: `"Ver detalhes"`, `"Registrar pagamento"`, `"Lista de chamada"`).
  2. `"Editar"` (ícone `Pencil`).
  3. Ações de ciclo de vida separadas por `separator: true`: `"Inativar"` / `"Reativar"` (`Power`) ou `"Cancelar"` / `"Excluir"` (`Trash2`, `variant: "destructive"`).

---

## 2. Anatomia Padrão de Modais de Formulário (`Dialog`)

### 2.1. Estrutura Flexbox com Cabeçalho e Rodapé Fixos (`shrink-0`)
Todo modal de formulário (`*-form.tsx` / `*-dialog.tsx`) deve dividir a estrutura em 3 regiões para que o cabeçalho e o rodapé nunca rolem junto com os campos:

1. **`DialogContent`**: `className="sm:max-w-lg max-h-[88vh] flex flex-col p-0 overflow-hidden"`, com `expandable` e `storageKey="<modulo>-form"` nos formulários médios/grandes.
2. **`DialogHeader`**: `className="p-6 pb-2 pr-20 shrink-0"` (reserva espaço à direita para o botão `X` e o botão expandir).
3. **`<form>` + `DialogBody` + `DialogFormFooter`**:
   - O `<form>` recebe `className="flex flex-col min-h-0 flex-1 overflow-hidden"`.
   - Os campos ficam dentro de `<DialogBody className="space-y-4">` (que gerencia o `overflow-y-auto`, padding `px-6 py-3` e o indicador `"Mais campos abaixo"`).
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

### 3.4. Indicador `"Mais campos abaixo"` e Rodapé de 2 Colunas no Mobile
- O indicador de rolagem `"Mais campos abaixo ⌄"` do `DialogBody` fica em uma **barra dedicada na base do scroll (`border-t bg-muted/30`)**, nunca em `position: absolute` flutuando sobre os inputs, e é ocultado automaticamente enquanto um input está focado no celular (`isMobileInputFocused`).
- O `DialogFooter` posiciona `Cancelar` e `Adicionar`/`Salvar` **lado a lado em 2 colunas no mobile** (`grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end`), economizando `~48px` de altura vertical.

### 3.5. `crypto.randomUUID()` em Redes Locais (`http://192.168.x.x`)
- Ao testar o app pelo celular via IP da rede local (`http://192.168.1.x:3000`), os navegadores mobile classificam a página como contexto não-seguro (`window.isSecureContext === false`) e deixam `crypto.randomUUID` como `undefined` (embora `crypto.getRandomValues` continue disponível).
- **Regra**: Nunca chame `crypto.randomUUID()` diretamente no código da aplicação ou dos serviços; use sempre `newId(prefix)` de `@/mocks/helpers.ts`, que possui fallback UUID v4 via `crypto.getRandomValues`.

---

## 4. Animações de Destaque e Guias Contextuais

- Qualquer animação de chamada de atenção (como o pulso no botão `Continuar →` da barra de onboarding `animate-onboarding-pulse` ou no botão `Personalizar regras e níveis` em `modality-form.tsx`) deve rodar por **exatamente 2 ciclos (`3.6s`) e encerrar suavemente** (`forwards` + limpeza de estado via `setTimeout`), **nunca** em loop infinito (`infinite`).
