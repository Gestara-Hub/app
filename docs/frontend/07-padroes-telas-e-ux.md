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

**Paginação (30/10/2026 e 07/11/2026, a pedido):** a `PaginationBar` fica só embaixo da lista, logo depois da `ListContainer`, sem repetir no topo (o total já está na `ListSummaryBar`). Trocar de página ou de quantidade por página leva a tela ao início do bloco da lista (o pai da barra, com a busca e os filtros), abaixo do topo fixo, só quando esse início já saiu da tela (`scrollToListStart`, `components/shared/list/list-scroll.ts`). Por isso a barra precisa ficar dentro do mesmo bloco da busca e da lista.
- **Padrão visual limpo e inteligente (07/11/2026):**
  - Os botões numéricos inativos usam estilo `ghost` (sem bordas pesadas); o botão da página ativa fica em destaque suave (`variant="default"`).
  - Quando há até 5 páginas (`totalPages <= 5`), as setas duplas redundantes (`«` e `»`) são omitidas automaticamente, mantendo apenas as setas simples (`‹` e `›`) e os números. As setas duplas só aparecem a partir de 6 páginas (`totalPages > 5`).
  - Quando há apenas 1 página (`totalPages <= 1`), os botões de navegação são totalmente omitidos, mantendo apenas a linha de contagem.
  - Setas e botões inativos/desabilitados têm opacidade clara (`disabled:opacity-25`).
  - Linha de contagem integrada com o seletor: `Mostrando X–Y de Z registros · por página: [10 ⌄]`, responsivo no mobile sem perder o seletor.

### 1.4. Linhas de Listagem (`ListRow`) e Menus de Ação (`⋮` + Botão Direito)
- Toda linha (`ListRow`) ou card de listagem deve oferecer as mesmas ações via:
  1. **`ListItemContextMenu`** envolvendo o elemento da linha/card (abre com clique direito no desktop ou toque longo no mobile).
  2. **`ListItemActionsMenu`** (`⋮`) posicionado no canto direito da linha/card.
- **Ordem padrão dos itens no menu (`ActionMenuItem[]`)**:
  1. Ações primárias de visualização/operação (ex.: `"Ver detalhes"`, `"Registrar pagamento"`, `"Lista de chamada"`).
  2. `"Editar"` (ícone `Pencil`).
  3. Ações de ciclo de vida separadas por `separator: true`: `"Inativar"` / `"Reativar"` (`Power`) ou `"Cancelar"` / `"Excluir"` (`Trash2`, `variant: "destructive"`).

**Menu enxuto: até 6 itens na primeira camada (09/11/2026, decidido com o dono).**
- A linha divisória antes das destrutivas é automática: o componente põe a linha antes da primeira ação com `destructive: true`, que fica sempre no fim.
- Ações do mesmo assunto vão para um submenu (`children` em `ListItemAction`). Submenu com uma ação só vira a própria ação; vazio some.
- **"Acompanhamento ›"** agrupa Registros de aula, Faixa/Nível, Notas e Testes e medidas na lista de Alunos e nos alunos da turma; na chamada da aula, Faixa/Nível e Notas ("Registrar aula" e a presença ficam na primeira camada, porque são o uso de toda aula).
- O que a ficha já resolve não se repete na lista: "Vender pacote" e "Cancelar pacote" saíram do menu da lista de Alunos (ficam em "Plano e pacotes" da ficha e no ⋮ do topo da ficha).
- Lista de Alunos fica com: Abrir ficha, Enviar WhatsApp, Enviar autorização (só pendente), Acompanhamento ›, Nova cobrança, Editar cadastro, Inativar/Reativar.

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
- **Sanfona em vez de abas**: uma lista com borda, uma linha por seção (título + resumo de uma linha + seta), fechadas por padrão; `?tab=<id>` abre uma. Cada seção abre o painel completo que já existia. Sem cartões de KPI: os números viram os resumos ("3 em aberto · R$ 270,00 · 1 atrasada"). Seção aberta (05/11/2026): a seção inteira (título e conteúdo) ganha fundo (`bg-muted/40`, `dark:bg-muted/25`) e uma barra fina à esquerda que para antes da borda, para ver onde cada seção começa e termina, mesmo com duas abertas seguidas; título em negrito e respiro no fim. Abrir e fechar deslizam (`Collapsible` de `@/components/ui/collapsible`: altura com leve fade, 320 ms ao abrir e 240 ms ao fechar; fundo, barra e seta acompanham; sem animação com movimento reduzido). O `CollapsibleSection` dos formulários (cadastro de aluno e de instrutor) segue o mesmo comportamento desde 05/11/2026: continua em cartões separados com ícone e selos, mas a parte aberta ganha o mesmo fundo, a barra, o negrito e o deslize.
- **Plano e pacotes (30/10/2026, a pedido):** seção logo abaixo de Turmas, só para quem vê cobranças (`billing:view`). O resumo fica em destaque (texto normal, não cinza): "Plano Inicial · R$ 130,00/mês · vence dia 27", "Pacote 10 aulas · 8 aulas restantes", "Bolsista integral" ou "Sem mensalidade". Aberta (`student-plan-panel.tsx`): nome do plano e valor grandes, a linha de situação, vencimento, pagamento e Pix Automático com "Trocar plano" (abre o cadastro), a bolsa e os pacotes (`StudentPackagesPanel` compacto: em uso com a barra do saldo, encerrados em "Mostrar encerrados", renovar e cancelar no ⋮). Substituiu a seção "Pacotes" e o cartão "Mensalidade" do Cadastro; `?tab=packages` abre ela.
- **Cadastro sem cartões (30/10/2026 e 07/11/2026, a pedido):** grade de até 3 colunas, sem título repetido nem segundo "Editar", só os campos preenchidos; o que falta vira "Falta e-mail e nascimento · Completar cadastro". Responsáveis na grade (sempre para menor). Menor de idade mostra a autorização LGPD: "Registrar termo impresso" abre diálogo explicativo (Art. 14 LGPD, retenção da folha física na recepção e seleção do responsável que assinou); caso tenha sido registrado por engano, permite "Desfazer registro" com confirmação para voltar a pendente; "Baixar termo" permite gerar o PDF. Enviar e copiar o link pelo WhatsApp ficam no aviso do topo.

### 1.9. Carregamento da rota: barra no topo (09/11/2026; sem `loading.tsx` desde 11/11/2026)
As páginas de `(app)` são dinâmicas (sessão e `requirePermission` no server): o Next só troca de tela quando a página chega do servidor. Para o clique não parecer parado em rede lenta:
- **Barra fina no topo em todas as telas** (decidido com o dono): a mesma `list-refresh-bar` da lista ao atualizar (`globals.css`), presa no topo da janela, correndo de um lado para o outro até a próxima tela chegar. Aparece só depois de 250 ms (troca rápida não mostra nada) e fica parada com movimento reduzido. Liga no clique de um link interno e some quando o endereço muda (`components/layout/navigation-progress.tsx`).
- **Sem `loading.tsx` em `(app)`** (11/11/2026): a fronteira de streaming dele fazia a página hidratar depois do layout; com as leituras em paralelo, os dados que o layout já tinha buscado chegavam antes e a página renderizava diferente do HTML do servidor (React #418, a tela inteira refeita no navegador). E o `redirect()` das guardas, dentro do streaming, quebrava o roteador do Next 16 (React #310). Perdeu-se a troca imediata para a tela vazia; a barra continua.
- Sem casca com formato de tela: uma casca de lista prometeria um formato que painel, detalhe e calendário não têm.

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
- **Câmera no celular (10/11/2026):** sem botão próprio. Tocar na área já oferece a câmera no iPhone e no Android (testado pelo dono); um botão "Tirar foto" chegou a ser feito e saiu no mesmo dia.
- As regras (`accept` com MIME exato, curinga `image/*` ou extensão `.pdf`; `maxSizeBytes`; `maxFiles`; `acceptLabel`) vão no campo **e** no schema: `filesSchema(regras)` de `@/lib/files`, para a lista marcar em vermelho o mesmo arquivo que o Zod recusa. Arquivo repetido (mesmo nome, tamanho e data) não duplica. Fora de formulário, use `FileDropzone` (controlado por `value`/`onChange`).
- Comprovante de pagamento: `RECEIPT_FILE_RULES` (imagem ou PDF, até 4 MB cada, no máximo 5; teto de 4 MB para todo envio, `MAX_UPLOAD_BYTES`, com um arquivo por requisição, desde 04/11/2026), já aplicado no `PaymentDialog`. Por enquanto os arquivos não são enviados (ver `docs/technical/05-modulo-financeiro.md`, seção 10).

- **Envio resistente a falha (04/11/2026, migração 86):** o arquivo sobe assim que entra na lista, um por requisição e com até 3 tentativas sozinho em falha de rede ou do servidor. Cada linha mostra a situação: "Enviando…", "Enviado" ou a falha com o botão de enviar de novo; uma falha não para os outros. O valor do campo é `UploadItem[]` (não mais `File[]`): valide com `uploadsSchema(regras)` (salvar só com todos enviados) e, ao salvar, passe `uploadedAttachments(valor)` ao serviço. O envio chega ao campo pelo `FileUploaderProvider` (no layout do app), então o campo não importa serviços.
- **Tirar da lista apaga na hora** o anexo ainda sem uso (`DELETE /api/attachments/[id]`, só o enviado pelo próprio usuário). Ao confirmar "Descartar alterações?" (gavetas e janelas) ou o "Descartar" da barra das Configurações, os arquivos já enviados naquele formulário são apagados na hora (05/11/2026; o servidor só apaga o sem uso, então depois de salvar nada sai). Aba fechada ou formulário abandonado sem descartar deixa o anexo solto: a rotina diária (`cron.daily`) apaga os sem uso há mais de 24 horas.
- **"Em uso" é o que algum registro aponta**, conferido no banco (`attachment_is_used`): comprovantes da cobrança, anexos do lançamento e do pagamento de professor, arquivo do documento da ficha, logo e arte dos modelos de certificado. Um registro novo que guardar anexo precisa entrar nessa função, senão a rotina apaga o arquivo.

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

### 2.8. Valor sugerido que acompanha outro campo (10/11/2026)
Quando um campo é preenchido pelo sistema e acompanha outro (valor da inscrição pelos dias escolhidos, modo de pagamento pelo plano), **não use `form.getFieldState(campo).isDirty`** para saber se a pessoa mexeu nele. O react-hook-form recalcula os campos "editados" comparando tudo com os valores iniciais: depois que o sistema troca o valor, qualquer mudança em outro campo marca este como editado, e a sugestão para de acompanhar.
- Bug real: na inscrição de evento por dia, "Só alguns dias" punha R$ 0 (nenhum dia marcado), o primeiro dia marcado travava a sugestão em zero e as inscrições saíam sem cobrança.
- Vale para todo formulário: o `FieldShell` lê `formState.isDirty` (aviso de descartar), e isso liga o recálculo do react-hook-form em todos.
- **Regra para valor posto pelo sistema:**
  - Não deve contar como alteração (padrões do espaço, horário sugerido, disponibilidade da unidade): `form.resetField(campo, { defaultValue })`. O valor sugerido vira o novo inicial, e o `isDirty` daquele campo volta a ser confiável. Exemplos: `turma-form.tsx`, `client-form.tsx`, `professional-form.tsx`, `activate-subaccount-dialog.tsx`.
  - Precisa acompanhar outro campo e ser salvo (fuso pelo estado nas Configurações, valor da inscrição pelos dias): guarde a última sugestão num `useRef` e só troque se o campo ainda mostra ela; use `shouldDirty: true` quando a tela salva só o que mudou. Exemplos: `organization-settings-card.tsx`, `register-drawer.tsx`.
  - Nunca `setValue` sem `shouldDirty` seguido de uma checagem de `isDirty` do mesmo campo.
- Revisão de 10/11/2026 (todos os formulários de `apps/web` e `apps/admin`): corrigidos inscrição de evento (valor), Configurações (fuso), nova turma (data e horários sugeridos, duração), novo profissional (disponibilidade) e novo aluno (padrões de cobrança). Já estavam certos: modo de pagamento do aluno, forma de cobrança e vagas da turma, endereço da conta de recebimento, telas de certificado e regras de cobrança.
- Dinheiro zerado num evento pago pede confirmação ("Inscrever sem cobrança?"), para cortesia ser sempre de propósito.


### 2.9. Cadastros longos em blocos (10/11/2026, decidido com o dono)
Formulário longo se divide em seções (`FormSection` de `@/components/form`) com **o mesmo visual da seção aberta da ficha do aluno** (`CollapsibleSection`, §1.8): borda fina, fundo suave (a mesma cor da ficha: `muted` a 40%, no escuro 25%, misturado com `--card`, para ficar igual também no tema escuro, onde o card é mais claro que o fundo) e a barra fina à esquerda que para antes da borda. Sem título visível e sem abrir/fechar (`title` só para leitor de tela); os blocos se separam pelo espaço entre eles (`space-y-4` no corpo). **No celular (abaixo de `sm`) a seção perde a caixa** (sem borda, fundo, barra nem padding) e os grupos se separam por `space-y-8`: a caixa comia a largura e os campos ficavam espremidos (pedido do dono, 10/11/2026). Seção com interruptor mantém a borda no celular, com padding menor (`p-3`). Campos de texto e selects ganham fundo próprio dentro do bloco. Histórico (10/11/2026): título em maiúsculas com linha pesou; só espaço ficou sem contexto; ícone com título não agradou; fundo cinza sem borda; o dono escolheu o visual da ficha. No evento, o campo "Quem conduz" tem rótulo. Dentro da seção não vai outro card (valores do curso e do evento ficam direto no bloco).
- **Quando usar seção (critério, 10/11/2026, decidido com o dono):** a barra lateral sempre quer dizer "este bloco está em uso".
  - **Formulário curto** (um assunto, até uns 6 campos: lançamento, cobrança avulsa, pacote, avaliação, usuário, serviço, bloqueio, inscrição): campos soltos, sem seção.
  - **Formulário longo com grupos fixos** (Nova turma, Novo evento): `FormSection`, sempre com fundo e barra.
  - **Partes que se ligam ou abrem**: só borda quando desligada ou fechada; fundo e barra quando ligada ou aberta. Seção que abre: `CollapsibleSection` (cadastro de aluno e de profissional). Seção com interruptor: `toggleSectionClass(ligada)` + `<SectionBar visible={ligada} />` (Nova modalidade: trilha de níveis, avaliações, testes e medidas).
  - Fora do critério: telas de Configurações (padrão próprio de blocos e barra de salvar) e avisos destacados (ex.: "Liberar acesso ao sistema" no profissional).

- **Nova turma e Novo evento seguem a mesma ordem:** Sobre (nome, modalidade; no evento, descrição recolhida em "+ Adicionar descrição") → Quem conduz → Quando (turma: data de início e encontros; evento: dias) → Vagas e cobrança (vagas, forma de cobrança e valores, avulsos na turma, "Conta para a graduação" no evento).
- Campo não fica ao lado de outro só para fechar a linha: "Vagas" e "Data de início" ficam cada um no seu bloco, com meia largura.
- Mesmos nomes nos dois: "Vagas" (antes "Capacidade (vagas)" na turma) e "Quem conduz".
- Quem conduz no evento: o seletor "Da equipe / Convidado" em cima e o campo embaixo; com duas pessoas ou mais, uma por linha numa lista com borda e lixeira.


### 2.10. Foco no campo com erro (10/11/2026, decidido com o dono)
Ao salvar com campo obrigatório vazio ou inválido, **o foco vai para o primeiro campo com erro, na ordem da tela**, em todo formulário.
- **Formulário com react-hook-form:** automático. O RHF foca o campo que tem `ref` (os campos de `@/components/form` passam o `ref`); o `FieldShell` cobre os controles próprios (lista de dias, chips, horários, aceite): ao salvar, o primeiro `FieldShell` com erro do formulário foca o primeiro controle dentro dele. Controle que mostra o erro sozinho passa `invalid` ao `FieldShell` (ex.: "Encontros e Horários" da turma).
- **Erro que volta do servidor por campo:** `handleFormApiError` marca e foca o primeiro.
- **Formulário fora do RHF** (login, criar e trocar senha, verificação em duas etapas, consentimento, código do certificado, troca de e-mail de acesso, assinatura, adicionar aluno na aula, substituto, notas): `focusField(id)` ou `focusFirstInvalid()` de `@/lib/form-errors`, na ordem da tela. **O erro de um campo fica logo abaixo dele** (como o `FieldShell`), também fora do RHF: login ("Informe seu e-mail." / "Informe sua senha."), criar senha e nova senha (tamanho e "senhas não são iguais"), E-mail de acesso. Só o erro sem campo (senha errada, link vencido, falha do servidor) fica no fim. Senha errada no login volta o foco para a senha, selecionada.
- No celular o foco abre o teclado, mas só depois do toque em salvar (não é foco automático ao abrir, que continua proibido, §3.2).

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
- **Regra**: Nunca chame `crypto.randomUUID()` diretamente no código da aplicação ou dos serviços; use `newId()` (`@/lib/new-id` nas telas, `@/services/world/ops` nos serviços), que tem fallback UUID v4 via `crypto.getRandomValues`.
- **Abrir o `pnpm dev` no celular (10/11/2026):** mesmo Wi-Fi, `http://<IP do computador>:3200`. O navegador não fala com o Supabase direto (login, dados e anexos passam pelo servidor do Next, que alcança o `127.0.0.1`), então o Supabase local não precisa de ajuste. O `next.config.ts` libera sozinho os IPs da rede em `allowedDevOrigins` a cada subida do servidor. Cookies de sessão e o CSP só exigem HTTPS em produção. Não funciona por IP: entrar com Google (o retorno do OAuth é o `localhost`) e links de e-mail (`NEXT_PUBLIC_APP_URL`); use e-mail e senha. A câmera do anexo só abre no celular de verdade. **Instalar como app no Android pede HTTPS:** pelo IP (`http://`) o Chrome só oferece "Criar atalho" (o iPhone instala mesmo em `http`). Para testar a instalação no Android: um túnel HTTPS (Cloudflare Tunnel ou ngrok, já liberados em `allowedDevOrigins`) ou, no Chrome do celular, `chrome://flags` → "Insecure origins treated as secure" com `http://<IP>:3200`. Em produção (HTTPS) instala normal.

---

## 4. Animações de Destaque e Guias Contextuais

- Qualquer animação de chamada de atenção (como o pulso no botão `Continuar →` da barra de onboarding `animate-onboarding-pulse` ou no botão `Personalizar regras e níveis` em `modality-form.tsx`) deve rodar por **exatamente 2 ciclos (`3.6s`) e encerrar suavemente** (`forwards` + limpeza de estado via `setTimeout`), **nunca** em loop infinito (`infinite`).

- **Exceção (10/11/2026, decidido com o dono):** a bolinha vermelha de resposta do suporte no avatar pulsa sem parar enquanto houver resposta não lida (halo discreto em `app-topbar.tsx`, desligado para quem prefere menos movimento). Ela some quando a pessoa abre a conversa.

### 4.1. Cor e destaque nas listas (10/11/2026)

- **Item salvo pisca:** depois de "Adicionar" ou "Salvar", a linha ou o card do item ganha um fundo verde suave que some em 1,6 s, e a lista rola até ele se estiver fora da tela (`lib/record-highlight.ts`). Para uma lista nova: a linha e o card levam `data-record-id={id}` e o hook de criar/editar leva `meta: { highlight: true }` (usa o `id` devolvido ou o enviado; uma função quando o id é outro, como o aluno da cobrança avulsa). Ligado hoje em alunos, turmas, planos, pacotes, modalidades, equipe, eventos, lançamentos, usuários e cobranças avulsas.
- **Avatar de iniciais neutro:** pessoas ficam em cinza. A cor por pessoa foi testada em 10/11/2026 e tirada no mesmo dia: enchia as listas de cor sem dizer nada. Só a modalidade usa cor no avatar (a do Calendário, `tone` vindo de `modality-colors.ts`).
- **Cor só para a situação:** uma cor por situação no sistema todo, com o ponto da cor antes do texto (`status-dot` em `globals.css`): pendente âmbar, pago verde, em atraso vermelho, isento azul claro, cancelado e encerrado cinza, sem riscado. Vale para cobranças, lançamentos, repasse do professor e Ativo/Inativo. Selos de informação (WhatsApp enviado, bolsa) são cinza.
- **Cobranças sem selo repetido (10 e 11/11/2026):** atraso não tem selo na lista; a data fica em vermelho com os dias ("venceu 10/11 · 1 dia"), e no aluno com várias cobranças só parte vencida ficam o selo "N em atraso" e o valor vencido. Em "Pagas" não aparece "Pago" e em "A receber" não aparece "Pendente". O valor da linha fica preto. As abas (A receber, Em atraso, Pagas, Isentas e encerradas, Todas) substituíram o seletor de situação, que repetia a mesma lista; o filtro fino que chega por link (pendentes, canceladas, isentas, substituídas) aparece como "Mostrando: …" ao lado do total, com "Limpar filtros".
- **Cor "vencido" (11/11/2026):** `text-overdue` (token `--color-overdue` em `globals.css`, o vermelho do tema misturado 30% com o cinza dos textos secundários), em peso normal, para datas e valores vencidos nas listas e o selo "N em atraso". O vermelho cheio fica para o alerta principal: número do cartão "Em atraso", valor do aviso de meses anteriores e contador da aba.
- **Cartão de indicador (`StatCard`, 11/11/2026):** os cartões do topo usam `@/components/shared/stat-card` e têm sempre 4 linhas: rótulo e ícone, valor, uma linha de apoio curta (cabe em uma linha, sem reticências) e o link para a lista que forma o número (`action`, obrigatório: "Ver entradas", "Ver pagas", "Cobrar atrasados"). Assim a fileira fica com a mesma altura e sem espaço vazio. Cor só no ícone (`iconTone`) e no valor (`valueTone`). Quando o link filtra a lista da própria tela (Cobranças), o cartão do filtro aplicado fica marcado (`active`: borda na cor de destaque), o link vira "Limpar filtro ×" e a tela rola até a lista; clicar de novo volta para a aba padrão. Usado em Cobranças e no Resumo do Financeiro.
- **Resumo do Financeiro (11/11/2026):** uma tela só; as visões Simplificada e Avançada e o seletor "Visão" saíram porque tinham os mesmos cartões. Ordem: 4 cartões (`StatCard`: "Saldo do mês" com "Sobrou N% do que entrou" e a previsão com abertos na dica, "Entrou", "Saiu", "Em atraso"), depois "Fluxo de caixa dos últimos 6 meses" à esquerda e "Contas a pagar" (até 5, o resto por link) à direita, e "Receitas e custos por categoria" em largura total, com "Bolsas concedidas" no pé das entradas. No celular, "Contas a pagar" vem antes do gráfico. Saíram o "Equilíbrio do mês" (repetia os cartões), a barra "% recebido" (misturava bases) e o "vs anterior". Cartões neutros, atraso no mesmo vermelho de Cobranças, sem "Ações rápidas"; "Contas a pagar" vazio em uma linha.
- **Cartões e avisos de atraso neutros:** o vermelho fica no ícone e no valor, não no fundo nem na borda do cartão.

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
- **Área que rola para o lado (`overflow-x-auto`) leva `relative`** (11/11/2026). Sem isso, o que tem posição absoluta dentro dela (o `sr-only` dos cards, selos, menus) se posiciona pelo bloco de fora e escapa da rolagem. O Chrome ignora, mas o Safari do iPhone conta essa sobra e encolhe a página inteira (zoom out). Foi o caso da grade do Calendário. Medir com o WebKit em tamanho de iPhone: procurar elemento com `position: absolute` cujo lado direito passa da largura da tela.
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
- **Som da chamada (09/11/2026, a pedido):** com o som ligado, um select escolhe entre 7 sons, cada um com um jeito claro: Confirmação (padrão: duas notas rápidas subindo, o "deu certo" mais reconhecível), Bipe (o som de antes), Sino, Gota, Acorde, Marimba e Suave. Ding, Duplo, Pop e Bolha saíram por soarem parecidos com outros; som salvo que saiu da lista volta para a Confirmação; escolher já toca o som, e "Testar" repete. Os sons são sintetizados no navegador (`lib/audio-feedback.ts`, sem arquivo) e a escolha fica em `UserPreferences.checkinSound`, por pessoa.
- **Abas segmentadas (`PageTabs`):** o contorno de foco aparece só pelo teclado.

## Relatórios: catálogo em lista (01/11/2026, decidido com o dono)

- O catálogo (`features/reports/reports-catalog-tab.tsx`) é uma lista por categoria (Operacionais, Financeiros, Retenção): uma linha por relatório (ícone, título, descrição de uma linha, chevron), a linha inteira abre (`aria-label` "Abrir {título}"). Antes eram cards grandes com botão "Abrir" de largura total e a tela rolava para 8 itens.
- Sem busca (8 itens fixos) e sem seletor de mês no catálogo: o mês se escolhe dentro do relatório aberto, no cabeçalho ao lado do título (todos os relatórios são do mês, inclusive a relação de alunos, que mostra quem já era aluno no mês).
- Os do Plano Profissional ficam no grupo deles com a etiqueta e o cadeado; a linha abre o convite ("Ver no Plano Profissional: {título}").
- Relatório aberto e convite usam o "‹ Voltar" padrão (volta ao catálogo, que é estado da mesma tela).

## Auditoria (01/11/2026, decidido com o dono)

- **Cor só na ação** (`features/audit/audit-meta.tsx`): Criou e Reativou verde, Atualizou azul, Removeu e Cancelou vermelho, Inativou âmbar, Remarcou roxo, Mudou status cinza. O tipo do alvo fica cinza com um ícone (aluno, turma, certificado...). Colorir os dois viraria arco-íris.
- **Frase sem o autor:** a linha começa no verbo ("Atualizou a turma X"); o autor e o perfil ficam à direita. O resumo completo segue no registro, no drawer e no nome acessível da linha ("Detalhes: ...", que os testes usam).
- **Grupos por dia** com cabeçalho fixo ao rolar ("Hoje", "Ontem" ou a data) e só a hora em cada linha.
- **Filtros:** busca, "O quê" (tipo do alvo), "Ação" (novo: `AuditLogFilter.action`), "Quem" (pessoas, sistema, só o que falhou, ou um usuário) e "Período" (hoje, 7 dias, 30 dias, este mês, personalizado). O primeiro item de cada select diz o que ele filtra ("O quê: tudo", "Ação: todas").
- **Detalhe em drawer** à direita: autor, ação e tipo, a frase completa, o alvo com "Abrir aluno" ou "Abrir turma" quando a tela existe, alterações (só quando há), detalhes técnicos recolhidos com "Copiar registro (JSON)" lá dentro, e a nota de registro imutável.

## Recebimentos online antes de ativar (01/11/2026, decidido com o dono)

**Tour depois de ativar (01/11/2026).** Com a conta ativa, na aba Carteira & Extrato, um tour do produto (`ProductTour`, `components/shared/product-tour.tsx`) explica a tela uma vez por navegador (`gestarahub_tour_online_payments`): um passo por aba e por função, uma frase cada (Carteira & Extrato, Disponível para saque, A liberar, Recebido no mês, Histórico, Sacar via Pix só para quem gerencia, Extrato em PDF só para quem vê o financeiro, Configurações). Alvos por `data-tour="op-*"` em `online-payments-view.tsx` e `subaccount-panel.tsx`; sem o passo do menu no celular. A fixture do e2e marca o tour como visto.

É a tela que vende o Pix ao próprio cliente (a taxa por cobrança é parte da receita). Ordem: hero com o benefício ("Pix e cartão com baixa automática", "O aluno paga pelo celular; a cobrança baixa sozinha") e o fluxo desenhado em três cartões leves (mensalidade, Pix pago, cobrança baixada); "Como funciona" em 3 passos numerados (ative, cobre, recebeu e baixou); **"Quanto você recebe"**: valor da cobrança com atalhos (R$ 100, 150, 250), líquido no Pix e no cartão e a chave "Repassar as taxas ao aluno", pelo mesmo `calculateOnlineChargeAmounts` da prévia de cobrança, com a tarifa cheia do parceiro e a taxa do plano atual; "Taxas" compactas em duas colunas com a etiqueta "Seu plano: ... · R$ por cobrança"; faixa de garantias (baixa automática, lembrete com link, saque quando quiser, parceiro regulado). Sem números de marketing (clientes, volume), como na LP.
