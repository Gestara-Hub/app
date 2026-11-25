"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useFormContext,
  type FieldValues,
  type Path,
  type PathValue,
} from "react-hook-form";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { BRAZIL_STATES, normalizeStateUf } from "@/lib/brazil-states";
import { fetchAddressByCep } from "@/lib/cep";
import { FieldShell, fieldAria } from "./field-shell";
import { InputText } from "./input-text";
import { SelectField } from "./select-field";

const STATE_OPTIONS = BRAZIL_STATES.map((s) => ({
  value: s.uf,
  label: `${s.uf} · ${s.name}`,
  shortLabel: s.uf,
}));

interface AddressFieldsProps<T extends FieldValues = FieldValues> {
  prefix?: Path<T> | string;
  disabled?: boolean;
  required?: boolean;
  /** Cidade e UF obrigatorias (padrao: igual a `required`). Falso quando o CEP basta. */
  cityStateRequired?: boolean;
}

/** "69041010" -> "69041-010" (o que veio salvo sem o traco). */
function formatPostalCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function AddressFields<T extends FieldValues = FieldValues>({
  prefix = "address",
  disabled,
  required = false,
  cityStateRequired = required,
}: AddressFieldsProps<T>) {
  const { setValue, watch, getFieldState } = useFormContext<T>();
  const [loading, setLoading] = useState(false);
  const lastSearchedCep = useRef<string>("");

  const getFieldName = useCallback(
    (field: string): Path<T> => {
      return (prefix ? `${String(prefix)}.${field}` : field) as Path<T>;
    },
    [prefix],
  );

  const postalCodeField = getFieldName("postalCode");
  const postalCodeValue = (watch(postalCodeField) as string) ?? "";
  const postalCodeState = getFieldState(postalCodeField);

  // UF vem de select: valor antigo digitado ("sp", "São Paulo") vira a sigla;
  // texto que nao e estado e limpo. Sem marcar o formulario como alterado.
  const stateField = getFieldName("state");
  const stateValue = watch(stateField) as string | undefined;
  useEffect(() => {
    if (!stateValue) return;
    const uf = normalizeStateUf(stateValue);
    if (uf !== stateValue) setValue(stateField, uf as PathValue<T, Path<T>>);
  }, [stateValue, stateField, setValue]);

  const executeLookup = useCallback(
    async (rawCep: string, isManual = false) => {
      const clean = rawCep.replace(/\D/g, "");
      if (clean.length !== 8) {
        if (isManual) {
          toast.error("Informe um CEP válido com 8 dígitos.");
        }
        return;
      }

      if (!isManual && lastSearchedCep.current === clean) {
        return;
      }

      lastSearchedCep.current = clean;
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
            normalizeStateUf(result.state) as PathValue<T, Path<T>>,
            { shouldValidate: true, shouldDirty: true },
          );
          toast.success("Endereço preenchido pelo CEP.");
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
    },
    [getFieldName, setValue],
  );

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    const clean = raw;
    if (raw.length > 5) {
      raw = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    }
    setValue(postalCodeField, raw as PathValue<T, Path<T>>, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (clean.length === 8) {
      void executeLookup(clean, false);
    } else {
      lastSearchedCep.current = "";
    }
  };

  const handleManualSearch = () => {
    void executeLookup(postalCodeValue, true);
  };

  // Grade pela largura do proprio bloco, nao da tela (25/11/2026): no drawer
  // estreito (ativar recebimentos, checkout) as 3 colunas espremiam CEP, numero
  // e UF. Estreito: 1 coluna; medio: 2 colunas (CEP e Numero lado a lado,
  // Cidade e UF lado a lado); largo: a grade de 3 colunas de sempre.
  const half = "@sm:col-span-1 @xl:col-span-2";
  const wide = "@sm:col-span-2 @xl:col-span-4";
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @xl:grid-cols-6">
        <div className={cn(half, "@sm:order-1 @xl:order-none")}>
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
                inputMode="numeric"
                disabled={disabled || loading}
                // CEP salvo so com digitos tambem aparece com o traco.
                value={formatPostalCode(postalCodeValue)}
                onChange={handlePostalCodeChange}
                maxLength={9}
                className="min-w-0"
                {...fieldAria(postalCodeField, postalCodeState.error?.message)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={disabled || loading}
                onClick={handleManualSearch}
                title="Buscar CEP"
                aria-label="Buscar CEP"
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
        <div className={cn(wide, "@sm:order-3 @xl:order-none")}>
          <InputText<T>
            name={getFieldName("street")}
            label="Logradouro / Rua"
            placeholder="Rua, avenida, logradouro"
            required={required}
            disabled={disabled || loading}
          />
        </div>
        <div className={cn(half, "@sm:order-2 @xl:order-none")}>
          <InputText<T>
            name={getFieldName("number")}
            label="Número"
            placeholder="Número ou S/N"
            required={required}
            disabled={disabled || loading}
          />
        </div>
        <div className={cn(wide, "@sm:order-4 @xl:order-none")}>
          <InputText<T>
            name={getFieldName("complement")}
            label="Complemento"
            placeholder="Sala, bloco, andar (opcional)"
            disabled={disabled || loading}
          />
        </div>
        <div className="@sm:order-5 @sm:col-span-2 @xl:order-none @xl:col-span-2">
          <InputText<T>
            name={getFieldName("neighborhood")}
            label="Bairro"
            placeholder="Informe o bairro"
            required={required}
            disabled={disabled || loading}
          />
        </div>
        <div className={cn(half, "@sm:order-6 @xl:order-none")}>
          <InputText<T>
            name={getFieldName("city")}
            label="Cidade"
            placeholder="Informe a cidade"
            required={cityStateRequired}
            disabled={disabled || loading}
          />
        </div>
        <div className={cn(half, "@sm:order-7 @xl:order-none")}>
          <SelectField<T>
            name={stateField}
            label="Estado (UF)"
            placeholder="Selecione"
            options={STATE_OPTIONS}
            // Sem o "×" (25/11/2026): os outros campos de escolha do endereco nao tem.
            clearable={false}
            required={cityStateRequired}
            disabled={disabled || loading}
          />
        </div>
      </div>
    </div>
  );
}
