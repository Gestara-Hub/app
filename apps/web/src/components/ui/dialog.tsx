"use client"

import * as React from "react"
import { ChevronDown, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DialogExpandedContextValue {
  isExpanded: boolean
  toggleExpand: () => void
  expandable: boolean
}

const DialogExpandedContext = React.createContext<DialogExpandedContextValue>({
  isExpanded: false,
  toggleExpand: () => {},
  expandable: false,
})

const useDialogExpanded = () => React.useContext(DialogExpandedContext)

/**
 * Registro de formularios sujos dentro do dialog. Cada formulario (chave =
 * `control` do RHF) entra ao montar e sai ao desmontar, assim um subformulario
 * que fecha (ex.: "Adicionar ajuste" salvo ou cancelado) nao deixa o dialog
 * pedindo "Descartar alteracoes?".
 */
export interface DialogDirtyRegistry {
  mount: (source: object) => void
  unmount: (source: object) => void
  update: (source: object, dirty: boolean) => void
}

const DialogDirtyContext = React.createContext<DialogDirtyRegistry | null>(null)

export const useDialogDirty = () => React.useContext(DialogDirtyContext)

function Dialog({
  open,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [dirty, setDirty] = React.useState(false)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  // Por formulario: quantos campos montados e se esta sujo.
  const sourcesRef = React.useRef(new Map<object, { fields: number; dirty: boolean }>())

  const registry = React.useMemo<DialogDirtyRegistry>(() => {
    const recompute = () =>
      setDirty([...sourcesRef.current.values()].some((s) => s.dirty))
    return {
      mount(source) {
        const entry = sourcesRef.current.get(source)
        if (entry) entry.fields += 1
        else sourcesRef.current.set(source, { fields: 1, dirty: false })
      },
      unmount(source) {
        const entry = sourcesRef.current.get(source)
        if (!entry) return
        entry.fields -= 1
        if (entry.fields <= 0) sourcesRef.current.delete(source)
        recompute()
      },
      update(source, isDirty) {
        const entry = sourcesRef.current.get(source)
        if (!entry || entry.dirty === isDirty) return
        entry.dirty = isDirty
        recompute()
      },
    }
  }, [])

  React.useEffect(() => {
    if (!open) {
      for (const entry of sourcesRef.current.values()) entry.dirty = false
      setDirty(false)
      setConfirmDiscard(false)
    }
  }, [open])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && dirty) {
        setConfirmDiscard(true)
        return
      }
      if (!nextOpen) {
        setDirty(false)
      }
      onOpenChange?.(nextOpen)
    },
    [dirty, onOpenChange]
  )

  const handleConfirmDiscard = React.useCallback(() => {
    for (const entry of sourcesRef.current.values()) entry.dirty = false
    setDirty(false)
    setConfirmDiscard(false)
    onOpenChange?.(false)
  }, [onOpenChange])

  return (
    <DialogDirtyContext.Provider value={registry}>
      <DialogPrimitive.Root
        data-slot="dialog"
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              O que você preencheu neste formulário será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDiscard}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogDirtyContext.Provider>
  )
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

const MODAL_EXPANDED_STORAGE_PREFIX = "gestarahub:modal-expanded:"

function getSavedExpandedState(storageKey?: string): boolean {
  if (!storageKey || typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(`${MODAL_EXPANDED_STORAGE_PREFIX}${storageKey}`) === "true"
  } catch {
    return false
  }
}

function saveExpandedState(storageKey: string, isExpanded: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(`${MODAL_EXPANDED_STORAGE_PREFIX}${storageKey}`, String(isExpanded))
  } catch {
    // Ignora restricoes de sandbox ou cotas de armazenamento
  }
}

function DialogContent({
  className,
  style,
  children,
  showCloseButton = true,
  expandable = false,
  storageKey,
  expanded: controlledExpanded,
  onExpandedChange,
  expandedClassName = "max-sm:w-screen max-sm:max-w-none max-sm:h-dvh max-sm:max-h-dvh max-sm:top-0 max-sm:rounded-none max-sm:border-0 sm:max-w-4xl lg:max-w-5xl sm:h-[92vh] sm:max-h-[92vh]",
  closeOnInteractOutside = false,
  onOpenAutoFocus,
  onInteractOutside,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  expandable?: boolean
  storageKey?: string
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  expandedClassName?: string
  closeOnInteractOutside?: boolean
}) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState<boolean>(
    () => (expandable && storageKey ? getSavedExpandedState(storageKey) : false)
  )
  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : uncontrolledExpanded

  // No Chrome iOS (WKWebView), abrir o teclado virtual reduz `window.innerHeight`
  // e todas as unidades CSS (`vh`, `dvh`, `svh`), fazendo `max-h-[90vh]` cair para ~280px
  // e espremendo o formulário. Usando `style.maxHeight` inline em pixels baseado na
  // altura real da tela (`window.screen.height`), o inline style vence `max-h-[90vh]`
  // e mantém a modal totalmente aberta igual ao Safari.
  const [mobileMaxHeightPx, setMobileMaxHeightPx] = React.useState<number | null>(
    () => {
      if (typeof window === "undefined" || window.innerWidth >= 640) return null
      const screenHeight = window.screen?.height || window.innerHeight
      return Math.max(window.innerHeight - 32, Math.round(screenHeight * 0.78))
    }
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const updateHeight = () => {
      if (window.innerWidth >= 640) {
        setMobileMaxHeightPx(null)
        return
      }
      const screenHeight = window.screen?.height || window.innerHeight
      const candidate = Math.max(
        window.innerHeight - 32,
        Math.round(screenHeight * 0.78)
      )
      setMobileMaxHeightPx((prev) =>
        prev === null || candidate > prev ? candidate : prev
      )
    }
    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])

  React.useEffect(() => {
    if (expandable && storageKey && controlledExpanded === undefined) {
      setUncontrolledExpanded(getSavedExpandedState(storageKey))
    }
  }, [expandable, storageKey, controlledExpanded])

  const handleToggle = React.useCallback(
    (next?: boolean) => {
      const resolved = next !== undefined ? next : !isExpanded
      if (controlledExpanded === undefined) {
        setUncontrolledExpanded(resolved)
      }
      if (expandable && storageKey) {
        saveExpandedState(storageKey, resolved)
      }
      onExpandedChange?.(resolved)
    },
    [isExpanded, controlledExpanded, onExpandedChange, expandable, storageKey]
  )

  const contextValue = React.useMemo(
    () => ({ isExpanded, toggleExpand: () => handleToggle(), expandable }),
    [isExpanded, handleToggle, expandable]
  )

  return (
    <DialogExpandedContext.Provider value={contextValue}>
      <DialogPortal data-slot="dialog-portal">
        <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          style={{
            ...(mobileMaxHeightPx && !isExpanded
              ? { maxHeight: `${mobileMaxHeightPx}px` }
              : {}),
            ...style,
          }}
          className={cn(
            "fixed left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] max-sm:top-4 max-sm:translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[min(90vh,calc(100dvh-3rem))] overflow-y-auto gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none transition-[max-width,width] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
            className,
            isExpanded && expandedClassName
          )}
          onOpenAutoFocus={(e) => {
            const isTouchDevice =
              typeof window !== "undefined" &&
              window.matchMedia("(pointer: coarse)").matches
            if (isTouchDevice) {
              e.preventDefault()
            } else {
              const target = e.currentTarget as HTMLElement | null
              const firstFocusable = target?.querySelector<HTMLElement>(
                'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
              )
              if (
                firstFocusable instanceof HTMLInputElement &&
                (firstFocusable.type === "date" || firstFocusable.type === "time")
              ) {
                e.preventDefault()
              }
            }
            onOpenAutoFocus?.(e)
          }}
          onInteractOutside={(e) => {
            if (!closeOnInteractOutside) {
              e.preventDefault()
            }
            onInteractOutside?.(e)
          }}
          onPointerDownOutside={(e) => {
            if (!closeOnInteractOutside) {
              e.preventDefault()
            }
            const target = e.target as HTMLElement | null
            if (
              target?.closest?.("[data-sonner-toaster]") ||
              target?.closest?.("[data-sonner-toast]")
            ) {
              e.preventDefault()
            }
            onPointerDownOutside?.(e)
          }}
          {...props}
        >
          {children}
          {(showCloseButton || expandable) && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
              {expandable && (
                <button
                  type="button"
                  data-slot="dialog-expand"
                  onClick={() => handleToggle()}
                  className="hidden sm:inline-flex rounded-xs p-1 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer"
                  title={isExpanded ? "Restaurar tamanho" : "Aumentar tamanho"}
                  aria-label={isExpanded ? "Restaurar tamanho" : "Aumentar tamanho"}
                >
                  {isExpanded ? <Minimize2Icon /> : <Maximize2Icon />}
                  <span className="sr-only">
                    {isExpanded ? "Reduzir modal" : "Aumentar modal"}
                  </span>
                </button>
              )}
              {showCloseButton && (
                <DialogPrimitive.Close
                  data-slot="dialog-close"
                  className="rounded-xs p-1 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer"
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogExpandedContext.Provider>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end max-sm:px-4 max-sm:py-3",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function DialogBody({
  className,
  contentClassName,
  children,
  showScrollCue = true,
  scrollCueLabel = "Mais campos abaixo",
  ...props
}: React.ComponentProps<"div"> & {
  contentClassName?: string
  showScrollCue?: boolean
  scrollCueLabel?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = React.useState(false)
  const [canScrollDown, setCanScrollDown] = React.useState(false)
  const [isMobileInputFocused, setIsMobileInputFocused] = React.useState(false)

  const checkScroll = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const hasUp = el.scrollTop > 6
    const hasDown = el.scrollHeight - el.scrollTop - el.clientHeight > 6
    setCanScrollUp(hasUp)
    setCanScrollDown(hasDown)
  }, [])

  React.useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container) return

    const handleFocusIn = (e: FocusEvent) => {
      const isTouch =
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches
      if (!isTouch) return
      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        setIsMobileInputFocused(true)
      }
    }

    const handleFocusOut = () => {
      setIsMobileInputFocused(false)
    }

    container.addEventListener("focusin", handleFocusIn)
    container.addEventListener("focusout", handleFocusOut)

    // Observa o container de rolagem e o wrapper do conteúdo interno
    const resizeObserver = new ResizeObserver(() => {
      checkScroll()
    })
    resizeObserver.observe(container)
    if (content) {
      resizeObserver.observe(content)
    }

    // MutationObserver para capturar inclusão/remoção de elementos (ex.: seções colapsáveis abrindo)
    const mutationObserver = new MutationObserver(() => {
      checkScroll()
    })
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    const rafId = requestAnimationFrame(() => {
      checkScroll()
    })
    const timerId = setTimeout(() => {
      checkScroll()
    }, 250)

    return () => {
      container.removeEventListener("focusin", handleFocusIn)
      container.removeEventListener("focusout", handleFocusOut)
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [checkScroll])

  const scrollToBottom = () => {
    const el = containerRef.current
    if (!el) return
    el.scrollBy({ top: 200, behavior: "smooth" })
  }

  const showCue = showScrollCue && canScrollDown && !isMobileInputFocused

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Indicador superior (sombra quando houver conteúdo acima) */}
      <div
        className={cn(
          "pointer-events-none absolute top-0 left-0 right-0 z-10 h-4 bg-gradient-to-b from-black/10 to-transparent transition-opacity duration-200 dark:from-black/40",
          canScrollUp ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Área rolável principal */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        data-slot="dialog-body"
        className={cn("flex-1 overflow-y-auto min-h-0 p-6", className)}
        {...props}
      >
        <div ref={contentRef} className={cn("space-y-4", contentClassName)}>
          {children}
        </div>
      </div>

      {/* Barra dedicada fora da área dos inputs (nunca sobrepõe caixas de texto) */}
      {showCue ? (
        <div className="shrink-0 flex justify-center border-t border-border/40 bg-muted/30 px-4 py-1">
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Rolar para ver mais campos"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer select-none active:scale-95"
            title="Clique para rolar e ver mais opções"
          >
            <span>{scrollCueLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 animate-bounce text-primary" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  useDialogExpanded,
}
