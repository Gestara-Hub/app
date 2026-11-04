"use client";

import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText } from "lucide-react";
import type { Id, PersonDocumentKind, PersonDocumentOwnerKind, PersonDocumentView } from "@gestarahub/contracts";
import {
  MAX_DOCUMENT_NOTES_LENGTH,
  MAX_DOCUMENT_TITLE_LENGTH,
  documentKindExpires,
  documentKindsFor,
} from "@gestarahub/core/person-documents";
import { DateField, DialogFormFooter, FileDropField, InputText, SelectField, TextArea } from "@/components/form";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PERSON_DOCUMENT_FILE_RULES, filesSchema, formatBytes } from "@/lib/files";
import { handleFormApiError } from "@/lib/form-errors";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useCreatePersonDocument, useUpdatePersonDocument } from "../hooks/use-person-documents";

interface Values {
  kind: string;
  title: string;
  files: File[];
  expiresOn: string;
  notes: string;
}

function schemaFor(isEdit: boolean) {
  return z
    .object({
      kind: z.string().min(1, "Escolha o tipo do documento."),
      title: z.string().max(MAX_DOCUMENT_TITLE_LENGTH, `Use até ${MAX_DOCUMENT_TITLE_LENGTH} caracteres.`),
      files: isEdit ? z.array(z.instanceof(File)) : filesSchema({ ...PERSON_DOCUMENT_FILE_RULES, required: true }),
      expiresOn: z.string(),
      notes: z.string().max(MAX_DOCUMENT_NOTES_LENGTH, `Use até ${MAX_DOCUMENT_NOTES_LENGTH} caracteres.`),
    })
    .superRefine((v, ctx) => {
      if (v.kind === "other" && !v.title.trim()) {
        ctx.addIssue({ code: "custom", path: ["title"], message: "Dê um nome ao documento." });
      }
    });
}

function DocumentForm({
  ownerKind,
  ownerId,
  document,
  onDone,
}: {
  ownerKind: PersonDocumentOwnerKind;
  ownerId: Id;
  document?: PersonDocumentView;
  onDone: () => void;
}) {
  const createMut = useCreatePersonDocument();
  const updateMut = useUpdatePersonDocument();
  const pending = createMut.isPending || updateMut.isPending;
  const isEdit = Boolean(document);
  const form = useForm<Values>({
    resolver: zodResolver(schemaFor(isEdit)),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      kind: document?.kind ?? "",
      title: document?.title ?? "",
      files: [],
      expiresOn: document?.expiresOn ?? "",
      notes: document?.notes ?? "",
    },
  });
  const kind = useWatch({ control: form.control, name: "kind" }) as PersonDocumentKind | "";
  const expires = kind ? documentKindExpires(ownerKind, kind) : false;
  const options = documentKindsFor(ownerKind).map((k) => ({ value: k.value, label: k.label }));

  const onSubmit = form.handleSubmit(async (v) => {
    const payload = {
      kind: v.kind as PersonDocumentKind,
      // Fora do "Outro" o nome nao vale (trocar de "Outro" para outro tipo limpa).
      title: v.kind === "other" ? v.title.trim() : "",
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
          file: v.files[0],
        });
        toast.success("Documento adicionado.");
      }
      onDone();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o documento.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <SelectField<Values> name="kind" label="Tipo" required options={options} disabled={pending} placeholder="Escolha o tipo" />
          {/* Nome so no "Outro" (obrigatorio); nos demais a ficha usa o nome do tipo. */}
          {kind === "other" ? (
            <InputText<Values>
              name="title"
              label="Nome do documento"
              required
              placeholder="Informe o nome do documento"
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerKind: PersonDocumentOwnerKind;
  ownerId: Id;
  ownerName: string;
  document?: PersonDocumentView | null;
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
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
