"use client"

import * as React from "react"
import { ArrowDown, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"
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
  /** Fecha pelo `close` do chamador (ex.: Cancelar do rodape), pedindo confirmacao se houver alteracao. */
  guardClose: (close: () => void) => void
  /**
   * Avisa quando o usuario confirma "Descartar" (ex.: o campo de anexar apaga
   * os arquivos que ja tinha enviado). Devolve o cancelamento da inscricao.
   */
  onDiscard: (listener: () => void) => () => void
}

const DialogDirtyContext = React.createContext<DialogDirtyRegistry | null>(null)

export const useDialogDirty = () => React.useContext(DialogDirtyContext)

interface DialogSavingContextValue {
  saving: boolean
  setSaving: (source: object, saving: boolean) => void
}

const DialogSavingContext = React.createContext<DialogSavingContextValue | null>(null)

export const DialogSavingProvider = DialogSavingContext.Provider

export function useDialogSavingState() {
  return React.useContext(DialogSavingContext)?.saving ?? false
}

/**
 * Avisa o Dialog/Sheet pai que o formulario filho esta gravando no servidor:
 * liga a barra fina no topo, cobre o corpo para impedir edicoes e segura Esc/X.
 */
export function useReportDialogSaving(saving: boolean) {
  const ctx = React.useContext(DialogSavingContext)
  const [source] = React.useState(() => ({}))

  React.useEffect(() => {
    if (!ctx) return
    ctx.setSaving(source, saving)
  }, [ctx, source, saving])

  React.useEffect(() => {
    if (!ctx) return
    return () => ctx.setSaving(source, false)
  }, [ctx, source])
}

/**
 * Guarda "Descartar alteracoes?" e estado de salvamento do Dialog e do Sheet:
 * fechar com formulario sujo pede confirmacao; durante o salvamento bloqueia o
 * fechamento e propaga `savingValue` para barra superior e overlay.
 */
export function useDiscardGuard(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined
) {
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  // Por formulario: quantos campos montados e se esta sujo.
  const sourcesRef = React.useRef(new Map<object, { fields: number; dirty: boolean }>())
  const savingSourcesRef = React.useRef(new Set<object>())
  // Fechamento pedido pelo rodape (Cancelar), feito ao confirmar o descarte.
  const pendingCloseRef = React.useRef<(() => void) | null>(null)
  // Quem quer saber do descarte confirmado (campo de anexar).
  const discardListenersRef = React.useRef(new Set<() => void>())

  const setSourceSaving = React.useCallback((source: object, isSaving: boolean) => {
    const set = savingSourcesRef.current
    const had = set.has(source)
    if (isSaving === had) return
    if (isSaving) set.add(source)
    else set.delete(source)
    setSaving(set.size > 0)
  }, [])

  const savingValue = React.useMemo<DialogSavingContextValue>(
    () => ({ saving, setSaving: setSourceSaving }),
    [saving, setSourceSaving]
  )

  const registry = React.useMemo<DialogDirtyRegistry>(() => {
    const recompute = () =>
      setDirty([...sourcesRef.current.values()].some((s) => s.dirty))
    return {
      onDiscard(listener) {
        discardListenersRef.current.add(listener)
        return () => {
          discardListenersRef.current.delete(listener)
        }
      },
      guardClose(close) {
        if (savingSourcesRef.current.size > 0) return
        if ([...sourcesRef.current.values()].some((s) => s.dirty)) {
          pendingCloseRef.current = close
          setConfirmDiscard(true)
          return
        }
        close()
      },
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
      savingSourcesRef.current.clear()
      setDirty(false)
      setSaving(false)
      setConfirmDiscard(false)
    }
  }, [open])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && savingSourcesRef.current.size > 0) {
        return
      }
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
    for (const listener of discardListenersRef.current) listener()
    for (const entry of sourcesRef.current.values()) entry.dirty = false
    setDirty(false)
    setConfirmDiscard(false)
    const pending = pendingCloseRef.current
    pendingCloseRef.current = null
    if (pending) pending()
    else onOpenChange?.(false)
  }, [onOpenChange])

  const confirm = (
    <AlertDialog
      open={confirmDiscard}
      onOpenChange={(next) => {
        if (!next) pendingCloseRef.current = null
        setConfirmDiscard(next)
      }}
    >
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
  )

  return { registry, savingValue, handleOpenChange, confirm }
}

export const DialogDirtyProvider = DialogDirtyContext.Provider

/**
 * Toque ou foco numa janela aberta por cima, montada fora desta arvore React
 * (a confirmacao do envio pelo WhatsApp oficial vive no layout): nao e "fora".
 * O Radix so reconhece as camadas filhas na arvore; o foco nessa janela fechava
 * a janela ou o painel de baixo (Lembretes no sino, 31/10/2026).
 */
export function isInsideAnotherDialog(event: Event): boolean {
  const target = event.target as HTMLElement | null
  return Boolean(target?.closest?.('[role="dialog"], [role="alertdialog"]'))
}

/**
 * O Radix Dialog 1.1.17 adia o "clique fora" da janela modal para o `click`.
 * Com um menu ou uma lista aberta por cima, o `pointerdown` fecha o menu e, no
 * `click`, a janela ja e a camada de cima e fechava junto (menu ⋮ nos
 * Lembretes, 31/10/2026). Coberta, a janela fica com `pointer-events: none`
 * (regra do Radix): o toque que comecou assim nao conta como "fora".
 */
export function useOutsideClickGuard(): [
  guardId: string,
  startedCovered: (event: CustomEvent<{ originalEvent: PointerEvent }>) => boolean,
] {
  const guardId = React.useId()
  const blockedRef = React.useRef(new WeakSet<Event>())
  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const node = document.querySelector<HTMLElement>(`[data-outside-guard="${guardId}"]`)
      if (node?.style.pointerEvents === "none") blockedRef.current.add(event)
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [guardId])
  const startedCovered = React.useCallback(
    (event: CustomEvent<{ originalEvent: PointerEvent }>) => blockedRef.current.has(event.detail.originalEvent),
    []
  )
  return [guardId, startedCovered]
}

function Dialog({
  open,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const { registry, savingValue, handleOpenChange, confirm } = useDiscardGuard(open, onOpenChange)

  return (
    <DialogSavingContext.Provider value={savingValue}>
      <DialogDirtyContext.Provider value={registry}>
        <DialogPrimitive.Root
          data-slot="dialog"
          open={open}
          onOpenChange={handleOpenChange}
          {...props}
        >
          {children}
        </DialogPrimitive.Root>
        {confirm}
      </DialogDirtyContext.Provider>
    </DialogSavingContext.Provider>
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
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-200",
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

function DialogSavingBar({ visible, label = "Salvando" }: { visible: boolean; label?: string }) {
  if (!visible) return null
  return (
    <div
      role="status"
      aria-label={label}
      data-slot="dialog-saving-bar"
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-primary/15"
    >
      <div className="dialog-saving-bar h-full w-1/3 rounded-full bg-primary" />
    </div>
  )
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
  saving,
  onOpenAutoFocus,
  onEscapeKeyDown,
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
  saving?: boolean
}) {
  const contextSaving = useDialogSavingState()
  const isSaving = Boolean(saving || contextSaving)
  const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState<boolean>(
    () => (expandable && storageKey ? getSavedExpandedState(storageKey) : false)
  )
  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : uncontrolledExpanded
  const [outsideGuardId, startedCovered] = useOutsideClickGuard()

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
          data-outside-guard={outsideGuardId}
          data-slot="dialog-content"
          aria-busy={isSaving || undefined}
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
          onEscapeKeyDown={(e) => {
            if (isSaving) {
              e.preventDefault()
            }
            onEscapeKeyDown?.(e)
          }}
          onInteractOutside={(e) => {
            if (isSaving || !closeOnInteractOutside || isInsideAnotherDialog(e)) {
              e.preventDefault()
            }
            onInteractOutside?.(e)
          }}
          onPointerDownOutside={(e) => {
            if (isSaving || !closeOnInteractOutside || startedCovered(e)) {
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
          <DialogSavingBar visible={isSaving} />
          {children}
          {(showCloseButton || expandable) && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
              {expandable && (
                <button
                  type="button"
                  data-slot="dialog-expand"
                  disabled={isSaving}
                  onClick={() => handleToggle()}
                  className="hidden sm:inline-flex rounded-xs p-1 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer"
                  title={isExpanded ? "Restaurar tamanho" : "Aumentar tamanho"}
                  aria-label={isExpanded ? "Restaurar tamanho" : "Aumentar tamanho"}
                >
                  {isExpanded ? <Minimize2Icon /> : <Maximize2Icon />}
                </button>
              )}
              {showCloseButton && (
                <DialogPrimitive.Close
                  data-slot="dialog-close"
                  disabled={isSaving}
                  className="rounded-xs p-1 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer"
                >
                  <XIcon />
                  <span className="sr-only">Fechar</span>
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
  saving = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
  saving?: boolean
}) {
  useReportDialogSaving(saving)
  // Celular: dois botoes lado a lado em partes iguais; um texto que nao cabe na
  // metade (o botao nao quebra linha) desce sozinho para uma linha inteira, com
  // o botao principal por cima (25/11/2026: "Confirmar transferencia Pix" vazava).
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-wrap-reverse gap-2 max-sm:*:grow max-sm:*:basis-[calc(50%-0.25rem)] sm:flex-row sm:flex-nowrap sm:justify-end max-sm:px-4 max-sm:py-3",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Fechar</Button>
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
  saving,
  ...props
}: React.ComponentProps<"div"> & {
  contentClassName?: string
  showScrollCue?: boolean
  scrollCueLabel?: string
  saving?: boolean
}) {
  const contextSaving = useDialogSavingState()
  const isSaving = Boolean(saving || contextSaving)
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
        inert={isSaving || undefined}
        tabIndex={canScrollUp || canScrollDown ? 0 : undefined}
        data-slot="dialog-body"
        className={cn("flex-1 overflow-y-auto min-h-0 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", className)}
        {...props}
      >
        <div ref={contentRef} className={cn("space-y-4", contentClassName)}>
          {children}
        </div>
      </div>

      {/* Overlay ao salvar: bloqueia cliques, rolagem e alteracoes no corpo do formulario. */}
      {isSaving ? (
        <div
          aria-hidden="true"
          data-slot="dialog-body-saving-overlay"
          className="absolute inset-0 z-20 cursor-wait bg-background/55 backdrop-blur-[1px] animate-in fade-in-0 duration-150"
        />
      ) : null}

      {/* Pill flutuante so com o icone: some no fim da rolagem e com o teclado
          aberto no celular, entao nao fica por cima do campo em que se digita. */}
      {showCue && !isSaving ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-background to-transparent" />
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label={scrollCueLabel}
            title={scrollCueLabel}
            className="absolute bottom-3 left-1/2 z-20 inline-flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-muted/90 text-foreground shadow-sm backdrop-blur-xs transition-colors select-none hover:bg-accent active:scale-95"
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
        </>
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
  DialogSavingBar,
  DialogTitle,
  DialogTrigger,
  useDialogExpanded,
}
