"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Collapsible(props: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

/**
 * Conteudo que abre e fecha deslizando (altura + leve fade), inclusive ao
 * fechar: o Radix so desmonta depois da animacao. Classe em globals.css.
 */
function CollapsibleContent({ className, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn("collapsible-content", className)}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleContent };
