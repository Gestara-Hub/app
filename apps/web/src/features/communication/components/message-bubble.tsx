/** Balao no estilo do WhatsApp com o texto como o aluno recebe. */
export function MessageBubble({ text }: { text: string }) {
  return (
    <div className="rounded-lg bg-emerald-500/[0.06] p-2.5">
      <p className="whitespace-pre-wrap rounded-lg rounded-tl-none border border-emerald-500/15 bg-background p-2.5 text-xs leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}
