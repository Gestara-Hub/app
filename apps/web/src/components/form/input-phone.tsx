"use client";

import { useMemo, useState, type Ref } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  callingCodeOf,
  countryFlag,
  DEFAULT_PHONE_COUNTRY,
  formatAsYouType,
  nationalDigitsOf,
  parseInternational,
  phoneCountries,
  phoneCountryName,
  phoneCountryOf,
  toStoredPhone,
  type PhoneCountry,
} from "@gestarahub/core/phone";
import { FieldShell, fieldAria } from "./field-shell";

interface InputPhoneProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

/** E.164 vai ate 15 digitos com o DDI. */
const MAX_DIGITS = 15;

/**
 * Campo de telefone com seletor de pais (Brasil +55 por padrao) e a mascara
 * do pais na digitacao. Colar "+1 415 555 2671" troca o pais sozinho. GUARDA
 * em E.164 ("+5511977770000"); dado antigo so com digitos vale como Brasil.
 */
export function InputPhone<T extends FieldValues>({
  name,
  label,
  placeholder,
  hint,
  required,
  disabled,
  id,
}: InputPhoneProps<T>) {
  const { control } = useFormContext<T>();
  const fieldId = id ?? String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell
          id={fieldId}
          label={label}
          hint={hint}
          error={fieldState.error?.message}
          required={required}
        >
          <PhoneControl
            id={fieldId}
            name={field.name}
            inputRef={field.ref}
            value={(field.value as string | undefined) ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            placeholder={placeholder}
            aria={fieldAria(fieldId, fieldState.error?.message, hint)}
          />
        </FieldShell>
      )}
    />
  );
}

function PhoneControl({
  id,
  name,
  inputRef,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  aria,
}: {
  id: string;
  name: string;
  inputRef: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  disabled?: boolean;
  placeholder?: string;
  aria: ReturnType<typeof fieldAria>;
}) {
  // Pais e digitos de quem digita; o valor guardado de fora (reset do
  // formulario) recomeca daqui.
  const [state, setState] = useState(() => ({
    country: phoneCountryOf(value),
    digits: nationalDigitsOf(value),
    value,
  }));
  let current = state;
  if (value !== state.value) {
    current = { country: phoneCountryOf(value), digits: nationalDigitsOf(value), value };
    setState(current);
  }
  const countries = useMemo(() => phoneCountries(), []);
  const display = formatAsYouType(current.country, current.digits);

  const commit = (country: PhoneCountry, digits: string) => {
    const stored = toStoredPhone(country, digits);
    setState({ country, digits, value: stored });
    onChange(stored);
  };

  const handleInput = (raw: string) => {
    // Numero com DDI colado ou digitado ("+1 415..."): o pais vem dele.
    if (raw.trim().startsWith("+")) {
      const parsed = parseInternational(raw);
      if (parsed) {
        commit(parsed.country, parsed.nationalDigits);
        return;
      }
    }
    let digits = raw.replace(/\D/g, "").slice(0, MAX_DIGITS - callingCodeOf(current.country).length);
    // Apagou so um caractere da mascara ("(", ")", "-"): apaga o digito antes dele.
    if (digits === current.digits && raw.length < display.length) digits = digits.slice(0, -1);
    commit(current.country, digits);
  };

  return (
    <div className="flex gap-2">
      <Select
        value={current.country}
        onValueChange={(next) => commit(next as PhoneCountry, current.digits)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={`País do telefone: ${phoneCountryName(current.country)}`}
          className="w-[104px] shrink-0"
        >
          <SelectValue>
            {countryFlag(current.country)} +{callingCodeOf(current.country)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {countries.map((country) => (
            <SelectItem key={country} value={country}>
              {countryFlag(country)} {phoneCountryName(country)} +{callingCodeOf(country)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder ?? (current.country === DEFAULT_PHONE_COUNTRY ? "(11) 99999-9999" : "Número")}
        disabled={disabled}
        value={display}
        onChange={(event) => handleInput(event.target.value)}
        onBlur={onBlur}
        name={name}
        ref={inputRef}
        {...aria}
      />
    </div>
  );
}
