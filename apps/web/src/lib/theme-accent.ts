"use client";

import { useSyncExternalStore } from "react";

/**
 * Cor de destaque do app (revisão de Configurações, 31/10/2026). Claro, escuro
 * ou do sistema fica no `next-themes`; a pessoa escolhe só a cor. Cor base,
 * cantos, menu lateral (escuro), fonte e estilo são fixos no CSS (`globals.css`).
 * Antes havia um personalizador completo (temas prontos, fontes, cantos...).
 */
export type ThemeColor =
  | "zinc"
  | "red"
  | "rose"
  | "orange"
  | "green"
  | "emerald"
  | "blue"
  | "cyan"
  | "yellow"
  | "violet";

export const THEME_COLORS: { name: ThemeColor; label: string; color: string }[] = [
  { name: "zinc", label: "Padrão", color: "#71717a" },
  { name: "red", label: "Vermelho", color: "#ef4444" },
  { name: "rose", label: "Rosa", color: "#f43f5e" },
  { name: "orange", label: "Laranja", color: "#f97316" },
  { name: "green", label: "Verde", color: "#22c55e" },
  { name: "emerald", label: "Esmeralda", color: "#10b981" },
  { name: "blue", label: "Azul", color: "#3b82f6" },
  { name: "cyan", label: "Ciano", color: "#06b6d4" },
  { name: "yellow", label: "Amarelo", color: "#eab308" },
  { name: "violet", label: "Violeta", color: "#8b5cf6" },
];

export const DEFAULT_THEME_COLOR: ThemeColor = "zinc";

/** Mesma chave de antes: quem já escolheu uma cor continua com ela. */
const STORAGE_KEY = "gestarahub:theme-generator-state";

/** Cor guardada que não existe mais (os cinzas repetidos, por exemplo) vira o padrão. */
export function normalizeThemeColor(value: unknown): ThemeColor {
  return THEME_COLORS.some((c) => c.name === value) ? (value as ThemeColor) : DEFAULT_THEME_COLOR;
}

function applyToDOM(color: ThemeColor) {
  document.documentElement.setAttribute("data-theme-color", color);
}

function save(color: ThemeColor) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeColor: color }));
  } catch {
    // Sem armazenamento (aba anônima, cota): fica só nesta visita.
  }
}

function load(): ThemeColor {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeThemeColor((JSON.parse(raw) as { themeColor?: unknown }).themeColor);
    return normalizeThemeColor(localStorage.getItem("gestarahub:theme-color"));
  } catch {
    return DEFAULT_THEME_COLOR;
  }
}

let current: ThemeColor = DEFAULT_THEME_COLOR;
const listeners = new Set<() => void>();
let syncingFromServer = false;

if (typeof window !== "undefined") {
  current = load();
  applyToDOM(current);
}

function set(color: ThemeColor) {
  current = color;
  applyToDOM(color);
  save(color);
  for (const listener of listeners) listener();
}

/**
 * Reaplica a cor salva no <html>. Se a hidratação falha, o React redesenha a
 * página e o atributo que o script do <head> pôs some.
 */
export function reapplySavedTheme(): void {
  applyToDOM(current);
}

/** A mudança veio do servidor (outro aparelho): não volta para ele. */
export function isThemeSyncingFromServer(): boolean {
  return syncingFromServer;
}

export function applyThemeColorFromServer(color: unknown): void {
  const next = normalizeThemeColor(color);
  if (next === current) return;
  syncingFromServer = true;
  try {
    set(next);
  } finally {
    syncingFromServer = false;
  }
}

export function resetThemeColor(): void {
  set(DEFAULT_THEME_COLOR);
}

export function subscribeToThemeColor(callback: (color: ThemeColor) => void): () => void {
  const handler = () => callback(current);
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function useThemeColor(): [ThemeColor, (color: ThemeColor) => void] {
  const color = useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_THEME_COLOR,
  );
  return [color, set];
}
