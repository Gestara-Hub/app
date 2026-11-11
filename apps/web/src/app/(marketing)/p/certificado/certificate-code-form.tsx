"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeCertificateCode } from "@gestarahub/core/certificate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { focusField } from "@/lib/form-errors";

/** Campo do codigo: aceita minusculas e sem tracos; vai para a pagina do certificado. */
export function CertificateCodeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const code = normalizeCertificateCode(value);
    if (!code) {
      setError("O código tem o formato GH-XXXX-XXXX.");
      focusField("certificate-code");
      return;
    }
    router.push(`/p/certificado/${code}`);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="certificate-code">Código</Label>
        <Input
          id="certificate-code"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="GH-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "certificate-code-error" : undefined}
          className="font-mono tracking-wide"
        />
        {error ? (
          <p id="certificate-code-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full">
        Verificar
      </Button>
    </form>
  );
}
