"use client";

import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { fieldHintId } from "./field-shell";

interface SwitchFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
}

/** Campo booleano (Switch) em uma linha label + controle, dentro de um cartao. */
export function SwitchField<T extends FieldValues>({
  name,
  label,
  hint,
  disabled,
  id,
}: SwitchFieldProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div
          data-disabled={disabled ? "true" : undefined}
          className={cn(
            "flex items-center justify-between rounded-md border p-3",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <div className={cn("space-y-0.5", disabled && "cursor-not-allowed")}>
            <Label
              htmlFor={fieldId}
              className={disabled ? "cursor-not-allowed text-muted-foreground" : undefined}
            >
              {label}
            </Label>
            {hint ? (
              <p id={fieldHintId(fieldId)} className="text-xs text-muted-foreground">
                {hint}
              </p>
            ) : null}
          </div>
          <Switch
            id={fieldId}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            disabled={disabled}
            aria-describedby={hint ? fieldHintId(fieldId) : undefined}
            ref={field.ref}
          />
        </div>
      )}
    />
  );
}
