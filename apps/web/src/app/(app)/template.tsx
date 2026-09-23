/**
 * Remontado a cada troca de pagina do app (layout, sidebar e topbar ficam).
 * O conteudo entra com fade e um leve deslize; trocar filtro/aba (search params)
 * nao remonta, entao nao anima. Quem prefere menos movimento nao ve o efeito.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-safe:ease-out">
      {children}
    </div>
  );
}
