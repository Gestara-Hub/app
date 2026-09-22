"use client";

import { useState } from "react";
import {
  useFormContext,
  type FieldValues,
  type Path,
  type PathValue,
} from "react-hook-form";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchAddressByCep } from "@/lib/cep";
import { FieldShell } from "./field-shell";
import { InputText } from "./input-text";

interface AddressFieldsProps<T extends FieldValues = FieldValues> {
  prefix?: Path<T> | string;
  disabled?: boolean;
  required?: boolean;
}

export function AddressFields<T extends FieldValues = FieldValues>({
  prefix = "address",
  disabled,
  required = false,
}: AddressFieldsProps<T>) {
  const { setValue, watch, getFieldState } = useFormContext<T>();
  const [loading, setLoading] = useState(false);

  const getFieldName = (field: string): Path<T> => {
    return (prefix ? `${String(prefix)}.${field}` : field) as Path<T>;
  };

  const postalCodeField = getFieldName("postalCode");
  const postalCodeValue = (watch(postalCodeField) as string) ?? "";
  const postalCodeState = getFieldState(postalCodeField);

  const handleLookup = async () => {
    const clean = postalCodeValue.replace(/\D/g, "");
    if (clean.length !== 8) {
      toast.error("Informe um CEP válido com 8 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const result = await fetchAddressByCep(clean);
      if (result) {
        setValue(
          getFieldName("street"),
          result.street as PathValue<T, Path<T>>,
          { shouldValidate: true, shouldDirty: true },
        );
        setValue(
          getFieldName("neighborhood"),
          result.neighborhood as PathValue<T, Path<T>>,
          { shouldValidate: true, shouldDirty: true },
        );
        setValue(
          getFieldName("city"),
          result.city as PathValue<T, Path<T>>,
          { shouldValidate: true, shouldDirty: true },
        );
        setValue(
          getFieldName("state"),
          result.state as PathValue<T, Path<T>>,
          { shouldValidate: true, shouldDirty: true },
        );
        toast.success("Endereço encontrado.");
        const numberInput = document.getElementById(getFieldName("number"));
        numberInput?.focus();
      } else {
        toast.info("CEP não localizado. Preencha o endereço manualmente.");
      }
    } catch {
      toast.error("Erro ao consultar CEP.");
    } finally {
      setLoading(false);
    }
  };

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    if (raw.length > 5) {
      raw = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    }
    setValue(postalCodeField, raw as PathValue<T, Path<T>>, {
      shouldDirty: true,
    });

    if (raw.replace(/\D/g, "").length === 8) {
      setTimeout(() => {
        handleLookup();
      }, 100);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <FieldShell
            id={postalCodeField}
            label="CEP"
            required={required}
            error={postalCodeState.error?.message}
          >
            <div className="flex gap-2">
              <Input
                id={postalCodeField}
                placeholder="00000-000"
                disabled={disabled || loading}
                value={postalCodeValue}
                onChange={handlePostalCodeChange}
                maxLength={9}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled || loading}
                onClick={handleLookup}
                title="Buscar CEP"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </FieldShell>
        </div>
        <div className="sm:col-span-2">
          <InputText<T>
            name={getFieldName("street")}
            label="Logradouro / Rua"
            placeholder="Ex: Av. Paulista, Rua das Flores"
            required={required}
            disabled={disabled || loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InputText<T>
          name={getFieldName("number")}
          label="Número"
          placeholder="Ex: 120, S/N"
          required={required}
          disabled={disabled || loading}
        />
        <div className="sm:col-span-2">
          <InputText<T>
            name={getFieldName("complement")}
            label="Complemento"
            placeholder="Ex: Apto 42, Bloco B, Sala 3"
            disabled={disabled || loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InputText<T>
          name={getFieldName("neighborhood")}
          label="Bairro"
          placeholder="Ex: Centro, Bela Vista"
          required={required}
          disabled={disabled || loading}
        />
        <InputText<T>
          name={getFieldName("city")}
          label="Cidade"
          placeholder="Ex: São Paulo"
          required={required}
          disabled={disabled || loading}
        />
        <InputText<T>
          name={getFieldName("state")}
          label="Estado (UF)"
          placeholder="Ex: SP"
          required={required}
          disabled={disabled || loading}
        />
      </div>
    </div>
  );
}
