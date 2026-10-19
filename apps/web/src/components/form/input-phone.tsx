"use client";

import { useId, useMemo, useState, type Ref } from "react";
import {
  Controller,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryListId = useId();

  let current = state;
  if (value !== state.value) {
    current = { country: phoneCountryOf(value), digits: nationalDigitsOf(value), value };
    setState(current);
  }
  const countries = useMemo(
    () =>
      phoneCountries().map((country) => {
        const namePt = phoneCountryName(country);
        const code = callingCodeOf(country);
        const flag = countryFlag(country);
        return {
          country,
          namePt,
          code,
          flag,
          searchValue: `${namePt} ${stripAccents(namePt)} +${code} ${code} ${country}`,
        };
      }),
    [],
  );
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

  const handleCountryOpenChange = (nextOpen: boolean) => {
    setCountryOpen(nextOpen);
    if (!nextOpen) {
      setCountrySearch("");
    }
  };

  return (
    <div className="flex gap-1.5">
      <Popover modal={true} open={countryOpen} onOpenChange={handleCountryOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={countryOpen}
            aria-controls={countryListId}
            aria-label={`País: ${phoneCountryName(current.country)} (+${callingCodeOf(current.country)})`}
            disabled={disabled}
            className={cn(
              "flex h-9 shrink-0 items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] dark:bg-input/30",
              "focus:border-ring focus:ring-[3px] focus:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <span className="whitespace-nowrap">
              {countryFlag(current.country)} +{callingCodeOf(current.country)}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(event) => {
            if (
              typeof window !== "undefined" &&
              window.matchMedia("(pointer: coarse)").matches
            ) {
              event.preventDefault();
            }
          }}
          className="w-72 p-0"
        >
          <Command>
            <CommandInput
              placeholder="Buscar país ou DDI..."
              value={countrySearch}
              onValueChange={setCountrySearch}
            />
            <CommandList
              id={countryListId}
              className="max-h-[min(16rem,var(--radix-popover-content-available-height))]"
            >
              <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
              <CommandGroup>
                {countries.map((item) => (
                  <CommandItem
                    key={item.country}
                    value={item.searchValue}
                    onSelect={() => {
                      commit(item.country, current.digits);
                      setCountrySearch("");
                      setCountryOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        item.country === current.country ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1 break-words">
                      {item.flag} {item.namePt}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      +{item.code}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
