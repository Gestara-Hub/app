"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface TypewriterTextProps {
  words: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Digita e apaga as palavras em sequencia. Todas as palavras ficam na mesma
 * celula da grade (invisiveis) para reservar a altura da mais longa: o texto
 * em volta nao pula quando uma palavra quebra linha no celular. Com movimento
 * reduzido, mostra so a primeira palavra, parada.
 */
export function TypewriterText({
  words,
  typingSpeed = 85,
  deletingSpeed = 40,
  pauseDuration = 1800,
  className,
}: TypewriterTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [wordIndex, setWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (reducedMotion || !words || words.length === 0) return;

    const currentWord = words[wordIndex % words.length];

    if (!isDeleting && displayedText === currentWord) {
      const timeout = setTimeout(() => {
        setIsDeleting(true);
      }, pauseDuration);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayedText === "") {
      const timeout = setTimeout(() => {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
      }, 300);
      return () => clearTimeout(timeout);
    }

    const nextLength = isDeleting
      ? displayedText.length - 1
      : displayedText.length + 1;

    const timeout = setTimeout(
      () => {
        setDisplayedText(currentWord.slice(0, nextLength));
      },
      isDeleting ? deletingSpeed : typingSpeed,
    );

    return () => clearTimeout(timeout);
  }, [reducedMotion, displayedText, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

  const text = reducedMotion ? (words[0] ?? "") : displayedText;

  return (
    <span className={`inline-grid ${className ?? ""}`}>
      {words.map((word) => (
        <span key={word} aria-hidden="true" className="invisible [grid-area:1/1]">
          {word}
        </span>
      ))}
      <span data-slot="typewriter-current" className="[grid-area:1/1]">
        {text || "​"}
        {reducedMotion ? null : (
          <span
            aria-hidden="true"
            className="inline-block w-[3px] h-[0.82em] align-middle bg-primary ml-1 animate-pulse"
          />
        )}
      </span>
    </span>
  );
}
