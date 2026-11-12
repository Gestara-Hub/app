"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Keyboard, WifiOff, X } from "lucide-react";
import type { CheckInList, TicketCheckResult } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatCents } from "@gestarahub/core/format";
import { PaymentDialog, type PaymentDialogResult } from "@/components/shared/payment-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useAudioFeedback } from "@/features/preferences";
import { useMarkChargePaid } from "@/features/turmas";
import { eventsService } from "@/services/events";
import { useCheckInTicket, useUndoCheckIn } from "../hooks/use-events";
import {
  checkOffline,
  hashTicketCode,
  loadCheckInList,
  queueCheckIn,
  queuedCheckIns,
  removeQueued,
  saveCheckInList,
} from "../offline-check-in";
import { TicketCheckResultView } from "./ticket-check-result";

/** Quanto tempo o "Pode entrar" fica na tela antes de voltar a ler. */
const OK_MS = 2000;
/** O mesmo codigo lido de novo logo em seguida e ignorado (a camera ve o QR varias vezes). */
const SAME_CODE_MS = 4000;

type Decoder = (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

/**
 * "Ler ingressos" (doc product/29 T6, decidido em 12/11/2026): a camera dentro
 * do app le um ingresso atras do outro. Tudo certo: confirma sozinho, com o som
 * da chamada e "Desfazer". Pagamento pendente ou "ja entrou": para e espera o
 * toque. "Digitar codigo" para ingresso amassado. A biblioteca de leitura
 * carrega so aqui.
 */
/** Sem rede de verdade (a chamada ao servidor nem saiu). */
function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError || (typeof error === "object" && error !== null && (error as { code?: string }).code === "NETWORK");
}

/** A cada minuto com internet: lista atualizada e fila enviada. */
const REFRESH_MS = 60_000;

export function TicketScanner({
  sessionId,
  eventName,
  onClose,
}: {
  sessionId: string;
  eventName: string;
  onClose: () => void;
}) {
  const check = useCheckInTicket(sessionId);
  const undo = useUndoCheckIn(sessionId);
  const markPaid = useMarkChargePaid();
  const { playChime } = useAudioFeedback();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const [result, setResult] = useState<{ value: TicketCheckResult; code: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [paying, setPaying] = useState(false);
  // Lista do dia guardada no aparelho e a fila do que entrou sem internet.
  const [list, setList] = useState<CheckInList | undefined>();
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [offlineResult, setOfflineResult] = useState(false);

  const present = list?.entries.filter((e) => e.checkedInAt).length ?? 0;
  const total = list?.entries.length ?? 0;

  /** Envia a fila e baixa a lista de novo (com internet). */
  const sync = useCallback(async () => {
    const pendingEntries = await queuedCheckIns(sessionId);
    if (pendingEntries.length > 0) {
      try {
        const res = await eventsService.syncOfflineCheckIns({
          sessionId,
          entries: pendingEntries.map(({ registrationId, code, at }) => ({ registrationId, code, at })),
        });
        await removeQueued(pendingEntries.map((e) => e.id!).filter((id) => id !== undefined));
        if (res.applied > 0) toast.success(`${res.applied} ${res.applied === 1 ? "entrada enviada" : "entradas enviadas"}.`);
        for (const d of res.duplicates) toast.warning(`Entrada repetida: ${d.studentName} já tinha entrado${d.firstBy ? ` (${d.firstBy})` : ""}.`);
        for (const r of res.rejected) toast.error(`Ingresso ${r.code}: ${r.reason}.`);
      } catch {
        return;
      }
    }
    try {
      const fresh = await eventsService.getCheckInList(sessionId);
      await saveCheckInList(fresh);
      setList(fresh);
    } catch {
      // Sem internet: segue com a lista guardada.
    }
    setQueued((await queuedCheckIns(sessionId)).length);
  }, [sessionId]);

  useEffect(() => {
    void loadCheckInList(sessionId).then(setList);
    void queuedCheckIns(sessionId).then((q) => setQueued(q.length));
    // Primeira sincronizacao logo depois de abrir (fora do corpo do efeito).
    const first = window.setTimeout(() => void sync(), 0);
    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void sync();
    }, REFRESH_MS);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [sessionId, sync]);

  /** Confere pela lista guardada e, se entrou, guarda na fila. */
  const checkWithoutInternet = useCallback(
    async (code: string, confirm: boolean, forceUnknown = false): Promise<TicketCheckResult> => {
      const stored = list ?? (await loadCheckInList(sessionId));
      if (!stored) return { outcome: "not_found", entered: false };
      const at = new Date().toISOString();
      if (forceUnknown) {
        await queueCheckIn({ sessionId, code, at });
        setQueued((n) => n + 1);
        return { outcome: "ok", entered: true, checkedInAt: at };
      }
      const { result, entry } = checkOffline(stored, await hashTicketCode(code), { confirm });
      if (result.entered && entry) {
        await queueCheckIn({ sessionId, registrationId: entry.registrationId, at, studentName: entry.studentName });
        entry.checkedInAt = at;
        await saveCheckInList(stored);
        setList({ ...stored });
        setQueued((n) => n + 1);
        return { ...result, checkedInAt: at };
      }
      return result;
    },
    [list, sessionId],
  );
  // Resultado que espera a decisao de quem esta na porta: a leitura para.
  const waiting = Boolean(result && !(result.value.outcome === "ok" && result.value.entered));

  const handleCode = useCallback(
    async (code: string, confirm = false) => {
      if (busy.current) return;
      const now = Date.now();
      if (!confirm && lastCode.current && lastCode.current.code === code && now - lastCode.current.at < SAME_CODE_MS) return;
      lastCode.current = { code, at: now };
      busy.current = true;
      try {
        let value: TicketCheckResult;
        let fromList = false;
        if (navigator.onLine) {
          try {
            value = await check.mutateAsync({ code, confirm });
          } catch (err) {
            if (!isNetworkFailure(err)) throw err;
            value = await checkWithoutInternet(code, confirm);
            fromList = true;
          }
        } else {
          value = await checkWithoutInternet(code, confirm);
          fromList = true;
        }
        setOfflineResult(fromList);
        setResult({ value, code });
        if (value.entered) playChime("checkin");
      } catch (err) {
        toast.error(getErrorMessage(err, "Não foi possível conferir o ingresso."));
      } finally {
        busy.current = false;
      }
    },
    [check, playChime, checkWithoutInternet],
  );

  // "Pode entrar" some sozinho; o resto espera o toque.
  useEffect(() => {
    if (!result || waiting) return;
    const timer = window.setTimeout(() => setResult(null), OK_MS);
    return () => window.clearTimeout(timer);
  }, [result, waiting]);

  // A leitura usa sempre a versao atual (pausada quando ha decisao pendente).
  const handleCodeRef = useRef<(code: string) => Promise<void>>(async () => undefined);
  useEffect(() => {
    handleCodeRef.current = async (code: string) => {
      if (waiting) return;
      await handleCode(code);
    };
  }, [handleCode, waiting]);

  // Camera traseira e leitura continua (pausa enquanto ha decisao pendente).
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let decode: Decoder | null = null;
    const start = async () => {
      try {
        decode = (await import("jsqr")).default as unknown as Decoder;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          if (stopped) return;
          const canvas = canvasRef.current;
          if (canvas && video.readyState >= 2 && !busy.current && decode) {
            const width = Math.min(640, video.videoWidth);
            const height = Math.round((video.videoHeight / video.videoWidth) * width) || width;
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (context) {
              context.drawImage(video, 0, 0, width, height);
              const found = decode(context.getImageData(0, 0, width, height).data, width, height);
              if (found?.data) void handleCodeRef.current(found.data);
            }
          }
          raf = window.setTimeout(tick, 250) as unknown as number;
        };
        tick();
      } catch {
        setCameraError("Não foi possível abrir a câmera. Libere o acesso nas permissões do navegador ou digite o código.");
      }
    };
    void start();
    return () => {
      stopped = true;
      window.clearTimeout(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const next = () => {
    setResult(null);
    lastCode.current = null;
  };

  const registerPayment = async (payment: PaymentDialogResult) => {
    const chargeId = result?.value.pendingChargeId;
    if (!chargeId || !result) return;
    try {
      await markPaid.mutateAsync({ id: chargeId, method: payment.method, paidOn: payment.paidOn, receipts: payment.receipts });
      setPaying(false);
      toast.success("Pagamento registrado.");
      await handleCode(result.code, true);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível registrar o pagamento."));
    }
  };

  const outcome = result?.value.outcome;
  const canConfirm = result && !result.value.entered && outcome === "payment_pending";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="min-w-0 break-words text-sm font-semibold">{eventName}</p>
          <p className="text-xs text-white/70">
            {total > 0 ? `${present} de ${total} entraram` : "Carregando a lista..."}
          </p>
        </div>
        <Button variant="secondary" size="icon" onClick={onClose} aria-label="Fechar leitor">
          <X className="size-4" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        {!cameraError ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-60 rounded-2xl border-2 border-white/80" />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <Camera className="size-8 text-white/70" />
            <p className="text-sm text-white/80">{cameraError}</p>
          </div>
        )}
      </div>

      <div className="space-y-3 bg-background p-4 text-foreground">
        {!online || queued > 0 ? (
          <p className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <WifiOff className="size-3.5 shrink-0" aria-hidden />
            {!online ? "Sem internet" : "Enviando"}
            {queued > 0 ? ` · ${queued} ${queued === 1 ? "entrada para enviar" : "entradas para enviar"}` : ""}
            {list ? ` · lista de ${new Date(list.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
        ) : null}
        {result ? (
          <>
            <TicketCheckResultView result={result.value} />
            <div className="flex flex-wrap gap-2">
              {result.value.entered && result.value.registrationId && !offlineResult ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    void undo.mutateAsync(result.value.registrationId!).then(() => toast.success("Entrada desfeita."));
                    next();
                  }}
                >
                  Desfazer
                </Button>
              ) : null}
              {canConfirm ? (
                <Button onClick={() => void handleCode(result.code, true)} disabled={check.isPending}>
                  Confirmar entrada
                </Button>
              ) : null}
              {/* Ingresso fora da lista guardada: confirma e confere ao sincronizar. */}
              {offlineResult && outcome === "not_found" ? (
                <Button
                  onClick={() =>
                    void checkWithoutInternet(result.code, true, true).then((value) => {
                      setResult({ value, code: result.code });
                      playChime("checkin");
                    })
                  }
                >
                  Confirmar entrada mesmo assim
                </Button>
              ) : null}
              {online && result.value.pendingChargeId && (outcome === "payment_pending" || outcome === "reserved") ? (
                <Button variant="outline" onClick={() => setPaying(true)}>
                  Registrar pagamento
                </Button>
              ) : null}
              {waiting ? (
                <Button variant="outline" onClick={next}>
                  Próximo
                </Button>
              ) : null}
            </div>
          </>
        ) : typing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) void handleCode(typed.trim());
              setTyped("");
            }}
          >
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Código do ingresso"
              autoCapitalize="characters"
              className="text-base md:text-sm"
              aria-label="Código do ingresso"
            />
            <Button type="submit">Conferir</Button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Aponte a câmera para o QR do ingresso.</p>
            <Button variant="outline" onClick={() => setTyping(true)}>
              <Keyboard className="size-4" />
              Digitar código
            </Button>
          </div>
        )}
      </div>

      <PaymentDialog
        open={paying}
        title="Registrar pagamento"
        description="Confirme como a pessoa pagou na porta."
        confirmLabel="Registrar e deixar entrar"
        isPending={markPaid.isPending}
        onOpenChange={setPaying}
        onConfirm={(payment) => void registerPayment(payment)}
        summary={
          result?.value.pendingCents ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              {result.value.studentName} · {formatCents(result.value.pendingCents)}
            </p>
          ) : null
        }
      />
    </div>
  );
}
