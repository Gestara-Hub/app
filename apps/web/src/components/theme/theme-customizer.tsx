"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Dices,
  Palette,
  Redo2,
  RotateCcw,
  Sparkles,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
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
  type ThemeFont,
  type ThemeStyle,
} from "@/lib/theme-customizer";

type ActiveTab = "colors" | "typography" | "other";

/**
 * Painel completo de estilização visual e tema.
 * Pode ser embutido em Preferências ou aberto em gaveta dedicada.
 */
export function ThemeCustomizerPanel({ className }: { className?: string }) {
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
    mounted,
  } = useThemeCustomizer();

  const [activeTab, setActiveTab] = useState<ActiveTab>("colors");
  const activePresetId = getActivePresetId(state) ?? state.presetId;

  useEffect(() => {
    loadFontCatalogPreview();
  }, []);

  function handleRandomize() {
    randomize();
    toast.success("Novo tema gerado aleatoriamente!");
  }

  function handleReset() {
    resetTheme();
    toast.success("Tema redefinido para o padrão.");
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Presets Toolbar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Temas prontos</span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleRandomize}
              className="gap-1 text-[11px] font-medium"
            >
              <Dices className="size-3 text-primary" />
              Aleatório
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleReset}
              title="Redefinir padrões"
              className="text-muted-foreground hover:text-foreground text-[11px]"
            >
              <RotateCcw className="size-3 mr-1" />
              Redefinir
            </Button>
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

      {/* Visual Style & Base Color */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Estilo Visual</label>
          <Select value={state.style} onValueChange={(v) => setThemeStyle(v as ThemeStyle)}>
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

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cor Base (Neutros)</label>
          <Select value={state.baseColor} onValueChange={(v) => setBaseColor(v as BaseColor)}>
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="Selecione a base..." />
            </SelectTrigger>
            <SelectContent position="popper">
              {BASE_COLORS.map((b) => (
                <SelectItem key={b.name} value={b.name}>
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    {b.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Menu Color & Menu Accent */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cor do Menu Lateral</label>
          <Select value={state.menuColor} onValueChange={(v) => setMenuColor(v as MenuColor)}>
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
          <label className="text-xs font-medium text-muted-foreground">Destaque do Menu</label>
          <Select value={state.menuAccent} onValueChange={(v) => setMenuAccent(v as MenuAccent)}>
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

      {/* Sub-tabs: Cores / Tipografia / Bordas */}
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
            Cores de Destaque
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
            Cantos
          </button>
        </div>

        {/* Tab: Colors */}
        {activeTab === "colors" ? (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground block">
                Escolha a cor primária de destaque do sistema:
              </label>
              <div className="flex flex-wrap gap-2">
                {THEME_COLORS.map((c) => {
                  const isActive = mounted && state.themeColor === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setThemeColor(c.name)}
                      title={c.label}
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center transition-all border",
                        isActive
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                          : "border-black/20 hover:scale-105",
                      )}
                      style={{ backgroundColor: c.color }}
                    >
                      {isActive ? <Check className="size-4 text-white drop-shadow-sm" /> : null}
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
                Fonte do Sistema
              </label>
              <Select value={state.font} onValueChange={(v) => setThemeFont(v as ThemeFont)}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Selecione a fonte..." />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {THEME_FONTS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <span style={{ fontFamily: f.fontFamily }}>{f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              A tipografia selecionada é aplicada imediatamente a todos os títulos, textos e tabelas.
            </p>
          </div>
        ) : null}

        {/* Tab: Other (Radius) */}
        {activeTab === "other" ? (
          <div className="space-y-2 pt-1">
            <label className="text-xs font-medium text-muted-foreground block">
              Arredondamento dos cantos
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

      {/* Bottom Action Bar: Undo, Redo */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={undo}
            disabled={!canUndo}
            className="text-[11px]"
          >
            <Undo2 className="size-3 mr-1" />
            Desfazer
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={redo}
            disabled={!canRedo}
            className="text-[11px]"
          >
            <Redo2 className="size-3 mr-1" />
            Refazer
          </Button>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {THEME_COLORS.find((t) => t.name === state.themeColor)?.label ?? state.themeColor} · cantos {state.radius.replace(".", ",")}
        </span>
      </div>
    </div>
  );
}

/**
 * Drawer standalone para o personalizador de tema (quando acionado isoladamente).
 */
export function ThemeCustomizer() {
  const { resetTheme } = useThemeCustomizer();

  return (
    <Sheet onOpenChange={(open) => { if (open) loadFontCatalogPreview(); }}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
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
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border/60 px-5 py-4 space-y-0">
          <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Personalizador de Tema
          </SheetTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={resetTheme}
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ThemeCustomizerPanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}
