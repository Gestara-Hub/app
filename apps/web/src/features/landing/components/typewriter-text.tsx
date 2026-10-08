"use client";

import { useEffect, useState } from "react";

interface TypewriterTextProps {
  words: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
}

export function TypewriterText({
  words,
  typingSpeed = 85,
  deletingSpeed = 40,
  pauseDuration = 1800,
  className,
}: TypewriterTextProps) {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!words || words.length === 0) return;

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
  }, [displayedText, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className={className}>
      <span>{displayedText || "\u200B"}</span>
      <span
        aria-hidden="true"
        className="inline-block w-[3px] h-[0.82em] align-middle bg-primary ml-1 animate-pulse"
      />
    </span>
  );
}
