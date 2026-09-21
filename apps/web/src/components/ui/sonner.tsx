"use client"

import * as React from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  React.useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null
      if (
        target?.closest?.("[data-sonner-toaster]") ||
        target?.closest?.("[data-sonner-toast]")
      ) {
        e.stopImmediatePropagation()
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, true)
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true)
    }
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        close: <XIcon className="size-3" />,
      }}
      toastOptions={{
        classNames: {
          closeButton:
            "!size-5.5 !rounded-full !border !border-border/80 !bg-background !text-foreground/80 hover:!text-foreground hover:!bg-muted hover:!border-border !transition-colors !shadow-xs !flex !items-center !justify-center !cursor-pointer",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
