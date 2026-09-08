import { toast } from "sonner";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";

export function handleFormApiError<T extends FieldValues>(
  error: unknown,
  form: UseFormReturn<T>,
  fallbackMessage: string,
): void {
  const fields = getFieldErrors(error);
  if (fields && fields.length > 0) {
    for (const f of fields) {
      form.setError(f.field as Path<T>, { message: f.message });
    }
  } else {
    toast.error(getErrorMessage(error, fallbackMessage));
  }
}
