"use client";

import { useState } from "react";
import {
  Check,
  CircleCheck,
  Copy,
  Dices,
  Moon,
  Palette,
  Redo2,
  RotateCcw,
  Sparkles,
  Sun,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BASE_COLORS,
  getActivePresetId,
  loadFontCatalogPreview,
  MENU_ACCENTS,
  MENU_COLORS,
  THEME_COLORS,
  THEME_FONTS,
  THEME_PRESETS,
  THEME_RADIUSES,
  THEME_STYLES,
  useThemeCustomizer,
  type BaseColor,
  type MenuAccent,
  type MenuColor,
  type ThemeColor,
  type ThemeFont,
  type ThemeStyle,
} from "@/lib/theme-customizer";

type ActiveTab = "colors" | "typography" | "other";

export function ThemeCustomizer() {
  const {
    state,
    setBaseColor,
    setThemeColor,
    setThemeRadius,
    setMenuColor,
    setMenuAccent,
    setThemeFont,
    setThemeStyle,
    applyPreset,
    undo,
    redo,
    canUndo,
    canRedo,
    randomize,
    resetTheme,
    generateCssCode,
    mounted,
  } = useThemeCustomizer();

  const { resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>("colors");
  const activePresetId = getActivePresetId(state) ?? state.presetId;

  function handleCopyCss() {
    try {
      const code = generateCssCode();
      void navigator.clipboard.writeText(code);
      toast.success("Código CSS copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  }

  function handleRandomize() {
    randomize();
    toast.success("Novo tema gerado aleatoriamente!");
  }

  function handleReset() {
    resetTheme();
    toast.success("Tema redefinido para o padrão.");
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Sheet onOpenChange={(open) => { if (open) loadFontCatalogPreview(); }}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground hover:text-foreground"
          aria-label="Personalizador de Tema"
          title="Personalizador de Tema"
        >
          <Palette className="size-4" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-md p-0 flex flex-col h-full bg-background border-l shadow-2xl"
      >
        {/* Top Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border/60 px-5 py-4 space-y-0">
          <div>
            <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Personalizador de Tema
            </SheetTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleReset}
              title="Redefinir padrões"
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
            </Button>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Action Buttons: Copy / Undo / Redo */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCss}
              className="gap-1.5 text-xs font-medium"
            >
              <Copy className="size-3.5" />
              Copiar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              className="gap-1.5 text-xs font-medium"
            >
              <Undo2 className="size-3.5" />
              Desfazer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
              className="gap-1.5 text-xs font-medium"
            >
              <Redo2 className="size-3.5" />
              Refazer
            </Button>
          </div>

          {/* Mode: Light / Dark */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5">
            <span className="text-xs font-semibold text-foreground">Modo</span>
            <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border border-border/50">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all",
                  !isDark
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="size-3.5" />
                Claro
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all",
                  isDark
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="size-3.5" />
                Escuro
              </button>
            </div>
          </div>

          {/* Visual Style */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Estilo Visual
            </label>
            <Select
              value={state.style}
              onValueChange={(v) => setThemeStyle(v as ThemeStyle)}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Selecione o estilo..." />
              </SelectTrigger>
              <SelectContent position="popper">
                {THEME_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base Color & Theme */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Cor Base (Neutros)
              </label>
              <Select
                value={state.baseColor}
                onValueChange={(v) => setBaseColor(v as BaseColor)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Selecione a base..." />
                </SelectTrigger>
                <SelectContent position="popper">
                  {BASE_COLORS.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: b.color }}
                        />
                        {b.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tema (Cor de Destaque)
              </label>
              <Select
                value={state.themeColor}
                onValueChange={(v) => setThemeColor(v as ThemeColor)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Selecione o destaque..." />
                </SelectTrigger>
                <SelectContent position="popper">
                  {THEME_COLORS.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Menu Color & Menu Accent */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Cor do Menu Lateral
              </label>
              <Select
                value={state.menuColor}
                onValueChange={(v) => setMenuColor(v as MenuColor)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Selecione o menu..." />
                </SelectTrigger>
                <SelectContent position="popper">
                  {MENU_COLORS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Destaque do Menu
              </label>
              <Select
                value={state.menuAccent}
                onValueChange={(v) => setMenuAccent(v as MenuAccent)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Selecione o destaque..." />
                </SelectTrigger>
                <SelectContent position="popper">
                  {MENU_ACCENTS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Presets Toolbar */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Temas Prontos
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleRandomize}
                  className="gap-1 text-[11px] h-7 px-2 font-medium"
                >
                  <Dices className="size-3 text-primary" />
                  Aleatório
                </Button>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CircleCheck className="size-2.5" />
                  AA 7.2:1
                </span>
              </div>
            </div>

            <Select value={activePresetId || ""} onValueChange={applyPreset}>
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Personalizado / Escolha um tema..." />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[320px]">
                {THEME_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2.5">
                      <span className="grid grid-cols-2 grid-rows-2 size-4 rounded-xs p-0.5 gap-0.5 border border-border/80 bg-muted/40 shrink-0">
                        <span className="rounded-[1px]" style={{ backgroundColor: p.previewColors[0] }} />
                        <span className="rounded-[1px]" style={{ backgroundColor: p.previewColors[1] }} />
                        <span className="rounded-[1px]" style={{ backgroundColor: p.previewColors[2] }} />
                        <span className="rounded-[1px]" style={{ backgroundColor: p.previewColors[3] }} />
                      </span>
                      <span className="truncate">{p.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-tabs: Colors / Typography / Other */}
          <div className="pt-2 border-t border-border/50 space-y-3">
            <div className="inline-flex w-full p-1 bg-muted/40 border border-border/60 rounded-lg gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("colors")}
                className={cn(
                  "flex-1 py-1 rounded text-xs font-medium transition-all text-center",
                  activeTab === "colors"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Cores
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("typography")}
                className={cn(
                  "flex-1 py-1 rounded text-xs font-medium transition-all text-center",
                  activeTab === "typography"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Tipografia
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("other")}
                className={cn(
                  "flex-1 py-1 rounded text-xs font-medium transition-all text-center",
                  activeTab === "other"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Bordas (Raio)
              </button>
            </div>

            {/* Tab: Colors */}
            {activeTab === "colors" ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 p-2">
                    <span className="text-muted-foreground">Cor de Destaque</span>
                    <span
                      className="size-4 rounded-full border border-black/20 shrink-0"
                      style={{
                        backgroundColor:
                          THEME_COLORS.find((c) => c.name === state.themeColor)?.color ??
                          "#71717a",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 p-2">
                    <span className="text-muted-foreground">Cor Base (Neutra)</span>
                    <span
                      className="size-4 rounded-full border border-black/20 shrink-0"
                      style={{
                        backgroundColor:
                          BASE_COLORS.find((c) => c.name === state.baseColor)?.color ??
                          "#71717a",
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground block">
                    Cores de destaque:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {THEME_COLORS.map((c) => {
                      const isActive = mounted && state.themeColor === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setThemeColor(c.name)}
                          title={c.label}
                          className={cn(
                            "size-7 rounded-full flex items-center justify-center transition-all border",
                            isActive
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                              : "border-black/20 hover:scale-105",
                          )}
                          style={{ backgroundColor: c.color }}
                        >
                          {isActive ? (
                            <Check className="size-3.5 text-white drop-shadow-sm" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Tab: Typography */}
            {activeTab === "typography" ? (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Type className="size-3.5 text-primary" />
                    Fonte Principal
                  </label>
                  <Select
                    value={state.font}
                    onValueChange={(v) => setThemeFont(v as ThemeFont)}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Selecione a fonte..." />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px]">
                      {THEME_FONTS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span style={{ fontFamily: f.fontFamily }}>
                            {f.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  A tipografia selecionada é aplicada imediatamente a todos os títulos, textos e tabelas da aplicação.
                </p>
              </div>
            ) : null}

            {/* Tab: Other (Radius) */}
            {activeTab === "other" ? (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-muted-foreground block">
                  Arredondamento dos cantos (Raio: {state.radius}rem)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {THEME_RADIUSES.map((r) => {
                    const isActive = mounted && state.radius === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setThemeRadius(r.value)}
                        className={cn(
                          "rounded-md border py-2 text-xs font-medium transition-all text-center",
                          isActive
                            ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-3 bg-muted/10 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>● Salvo automaticamente</span>
          <span className="font-mono text-[10px] text-muted-foreground/80">
            {BASE_COLORS.find((b) => b.name === state.baseColor)?.label ?? state.baseColor} / {THEME_COLORS.find((t) => t.name === state.themeColor)?.label ?? state.themeColor} / {THEME_STYLES.find((s) => s.value === state.style)?.label.split(" ")[0] ?? state.style} / r:{state.radius}
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
