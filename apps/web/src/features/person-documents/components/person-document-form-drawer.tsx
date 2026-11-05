"use client";

import { useEffect } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText } from "lucide-react";
import type { Id, PersonDocumentKind, PersonDocumentOwnerKind, PersonDocumentView } from "@gestarahub/contracts";
import {
  MAX_DOCUMENT_NOTES_LENGTH,
  MAX_DOCUMENT_TITLE_LENGTH,
  documentCategoriesFor,
  documentCategoryOf,
  documentKindExpires,
  documentTitleMode,
} from "@gestarahub/core/person-documents";
import { DateField, DialogFormFooter, FileDropField, InputText, SelectField, TextArea } from "@/components/form";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PERSON_DOCUMENT_FILE_RULES, formatBytes, uploadedAttachments, uploadsSchema, type UploadItem } from "@/lib/files";
import { handleFormApiError } from "@/lib/form-errors";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useCreatePersonDocument, useUpdatePersonDocument } from "../hooks/use-person-documents";

interface Values {
  /** Categoria (so do formulario): filtra o segundo campo, o tipo. */
  category: string;
  kind: string;
  title: string;
  /** O arquivo sobe ao ser escolhido; salvar so com ele enviado. */
  files: UploadItem[];
  expiresOn: string;
  notes: string;
}

/** O grupo vazio (o "Outro") aparece como "Outro" no campo de categoria. */
function categoryLabel(group: string | undefined): string {
  return group === undefined ? "" : group || "Outro";
}

function schemaFor(isEdit: boolean, ownerKind: PersonDocumentOwnerKind) {
  return z
    .object({
      category: z.string().min(1, "Escolha a categoria."),
      kind: z.string(),
      title: z.string().max(MAX_DOCUMENT_TITLE_LENGTH, `Use até ${MAX_DOCUMENT_TITLE_LENGTH} caracteres.`),
      files: isEdit ? z.array(z.custom<UploadItem>()) : uploadsSchema({ ...PERSON_DOCUMENT_FILE_RULES, required: true }),
      expiresOn: z.string(),
      notes: z.string().max(MAX_DOCUMENT_NOTES_LENGTH, `Use até ${MAX_DOCUMENT_NOTES_LENGTH} caracteres.`),
    })
    .superRefine((v, ctx) => {
      if (v.category && !v.kind) ctx.addIssue({ code: "custom", path: ["kind"], message: "Escolha o tipo do documento." });
      if (v.kind && documentTitleMode(ownerKind, v.kind as PersonDocumentKind) === "required" && !v.title.trim()) {
        ctx.addIssue({ code: "custom", path: ["title"], message: "Dê um nome ao documento." });
      }
    });
}

function DocumentForm({
  ownerKind,
  ownerId,
  document,
  onDone,
  onSaved,
}: {
  ownerKind: PersonDocumentOwnerKind;
  ownerId: Id;
  document?: PersonDocumentView;
  onDone: () => void;
  /** Gravou: a lista mostra o carregamento ate os dados novos chegarem. */
  onSaved?: (mode: "create" | "update") => void;
}) {
  const createMut = useCreatePersonDocument();
  const updateMut = useUpdatePersonDocument();
  const pending = createMut.isPending || updateMut.isPending;
  const isEdit = Boolean(document);
  const form = useForm<Values>({
    resolver: zodResolver(schemaFor(isEdit, ownerKind)),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      category: document ? categoryLabel(documentCategoryOf(ownerKind, document.kind)) : "",
      kind: document?.kind ?? "",
      title: document?.title ?? "",
      files: [],
      expiresOn: document?.expiresOn ?? "",
      notes: document?.notes ?? "",
    },
  });
  const kind = useWatch({ control: form.control, name: "kind" }) as PersonDocumentKind | "";
  const categoryValue = useWatch({ control: form.control, name: "category" });
  // Dois campos: a categoria (Saude, Identificacao...) e o tipo dela. O tipo
  // aposentado so aparece no documento que ja o tem.
  const categories = documentCategoriesFor(ownerKind, document?.kind);
  const category = categories.find((c) => c.label === categoryValue);
  const kindOptions = (category?.kinds ?? []).map((k) => ({ value: k.value, label: k.label }));
  const singleKind = category?.kinds.length === 1 ? category.kinds[0].value : undefined;

  // Trocou a categoria: o tipo de outra categoria sai; categoria de um tipo so ja escolhe ele.
  useEffect(() => {
    if (!category) return;
    const current = form.getValues("kind");
    if (category.kinds.some((k) => k.value === current)) return;
    form.setValue("kind", singleKind ?? "", { shouldValidate: false });
  }, [category, singleKind, form]);
  const expires = kind ? documentKindExpires(ownerKind, kind) : false;
  const titleMode = kind ? documentTitleMode(ownerKind, kind) : "none";

  const onSubmit = form.handleSubmit(async (v) => {
    const payload = {
      kind: v.kind as PersonDocumentKind,
      // Fora do "Outro" o nome nao vale (trocar de "Outro" para outro tipo limpa).
      title: documentTitleMode(ownerKind, v.kind as PersonDocumentKind) === "none" ? "" : v.title.trim(),
      expiresOn: v.expiresOn,
      notes: v.notes.trim(),
    };
    try {
      if (document) {
        await updateMut.mutateAsync({ id: document.id, payload });
        toast.success("Documento atualizado.");
      } else {
        await createMut.mutateAsync({
          ownerKind,
          ownerId,
          ...payload,
          ...(payload.expiresOn ? {} : { expiresOn: undefined }),
          file: uploadedAttachments(v.files)[0],
        });
        toast.success("Documento adicionado.");
      }
      onSaved?.(document ? "update" : "create");
      onDone();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o documento.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <SelectField<Values>
            name="category"
            label="Categoria"
            required
            clearable={false}
            options={categories.map((c) => ({ value: c.label, label: c.label }))}
            disabled={pending}
            placeholder="Escolha a categoria"
          />
          {category && !singleKind ? (
            <SelectField<Values>
              key={category.label}
              name="kind"
              label="Tipo"
              required
              clearable={false}
              options={kindOptions}
              disabled={pending}
              placeholder="Escolha o tipo"
            />
          ) : null}
          {/* Nome livre: obrigatorio no "Outro"; "Qual documento" na identificacao; nos demais nao aparece. */}
          {titleMode === "required" ? (
            <InputText<Values>
              name="title"
              label="Nome do documento"
              required
              placeholder="Informe o nome do documento"
              disabled={pending}
            />
          ) : titleMode === "optional" ? (
            <InputText<Values>
              name="title"
              label="Qual documento (opcional)"
              placeholder="Informe RG, CIN, CNH ou outro"
              disabled={pending}
            />
          ) : null}
          {document ? (
            <div className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 break-words text-foreground">{document.file.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatBytes(document.file.sizeBytes)}</span>
            </div>
          ) : (
            <FileDropField<Values>
              name="files"
              label="Arquivo"
              required
              disabled={pending}
              {...PERSON_DOCUMENT_FILE_RULES}
            />
          )}
          <div className="w-48">
            <DateField<Values>
              name="expiresOn"
              label={expires ? "Válido até" : "Válido até (opcional)"}
              hint={expires ? "Avisamos antes de vencer." : undefined}
              disabled={pending}
            />
          </div>
          <TextArea<Values>
            name="notes"
            label="Observação (opcional)"
            placeholder="Anote o que a equipe precisa saber"
            rows={3}
            maxLength={MAX_DOCUMENT_NOTES_LENGTH}
            disabled={pending}
          />
        </DialogBody>
        <DialogFormFooter
          isPending={pending}
          isEdit={isEdit}
          className="shrink-0 border-t border-border/40 bg-background p-6 pt-4"
        />
      </form>
    </FormProvider>
  );
}

/** Novo documento na ficha (aluno ou instrutor), ou edicao do tipo, nome, validade e observacao. */
export function PersonDocumentFormDrawer({
  open,
  onOpenChange,
  ownerKind,
  ownerId,
  ownerName,
  document: documentProp,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerKind: PersonDocumentOwnerKind;
  ownerId: Id;
  ownerName: string;
  document?: PersonDocumentView | null;
  onSaved?: (mode: "create" | "update") => void;
}) {
  // Enquanto fecha, mantem o formulario montado (titulo e campos nao somem antes da animacao).
  // Aberto: o documento pedido (nenhum = novo). Fechando: o ultimo, ate a animacao acabar.
  const retained = useRetainedValue(documentProp ?? null);
  const document = (open ? documentProp : retained) ?? undefined;
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 p-6 pb-4 border-b border-border/40 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {document ? "Editar documento" : "Novo documento"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{ownerName}</SheetDescription>
        </SheetHeader>
        {present ? (
          <DocumentForm
            key={document?.id ?? "new"}
            ownerKind={ownerKind}
            ownerId={ownerId}
            document={document}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
