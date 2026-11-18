"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WhatsAppOnboarding } from "@gestarahub/contracts";
import { logError, logWarn } from "@/lib/log";

declare global {
  interface Window {
    FB?: {
      init: (params: {
        appId?: string;
        cookie?: boolean;
        status?: boolean;
        xfbml?: boolean;
        version?: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: {
            accessToken?: string;
            code?: string;
            expiresIn?: number;
            signedRequest?: string;
            userID?: string;
          };
          status?: string;
        }) => void,
        options?: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          locale?: string;
          extras?: Record<string, unknown>;
          scope?: string;
        },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export interface MetaEmbeddedSignupResult {
  code?: string;
  phoneNumberId?: string;
  wabaId?: string;
  businessId?: string;
  /** `FINISH`: numero novo na API; `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`: coexistencia com o app. */
  onboarding?: WhatsAppOnboarding;
}

export interface MetaEmbeddedSignupOptions {
  businessName?: string;
  phone?: string;
  email?: string;
}

function extractBrazilianLocalPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  // Se comecar com 55 e tiver 12 ou 13 digitos (55 + DDD + 8/9 digitos)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  // Se tiver 10 ou 11 digitos (DDD + 8/9 digitos)
  if (digits.length === 10 || digits.length === 11) {
    return digits;
  }
  return digits || undefined;
}

/**
 * Quanto esperar o aviso de conclusao da janela da Meta depois do callback do
 * FB.login. Os dois chegam separados e sem ordem garantida (17/11/2026: o app
 * resolvia so com o code, sem o numero, e a conexao caia no "cadastre o
 * telefone do espaco").
 */
const FINISH_WAIT_MS = 10_000;

export function useMetaEmbeddedSignup() {
  const [isSdkLoaded, setIsSdkLoaded] = useState(
    () => typeof window !== "undefined" && Boolean(window.FB),
  );
  const [isSigningUp, setIsSigningUp] = useState(false);
  const signupSessionRef = useRef<{
    resolve?: (result: MetaEmbeddedSignupResult) => void;
    reject?: (error: Error) => void;
    phoneNumberId?: string;
    wabaId?: string;
    businessId?: string;
    onboarding?: WhatsAppOnboarding;
    code?: string;
  }>({});

  /** Conclui a sessao uma vez so, com o que ja chegou (code e dados do numero). */
  const settleSignup = useCallback(() => {
    const session = signupSessionRef.current;
    if (!session.resolve) return;
    session.resolve({
      code: session.code,
      phoneNumberId: session.phoneNumberId,
      wabaId: session.wabaId,
      businessId: session.businessId,
      onboarding: session.onboarding,
    });
    session.resolve = undefined;
    session.reject = undefined;
    setIsSigningUp(false);
  }, []);

  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID?.trim();

  // Inicializa o Facebook JavaScript SDK
  useEffect(() => {
    if (!appId || window.FB) return;

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      setIsSdkLoaded(true);
    };

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/pt_BR/sdk.js";
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        logWarn("[Meta Embedded Signup] Falha ao carregar o script do Facebook SDK.");
      };
      document.head.appendChild(script);
    }
  }, [appId]);

  // Listener para capturar o postMessage oficial do WhatsApp Embedded Signup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Valida origem da mensagem da Meta
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          if (
            data.event === "FINISH" ||
            data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
          ) {
            const signupData = (data.data || {}) as {
              phone_number_id?: string;
              waba_id?: string;
              business_id?: string;
            };

            signupSessionRef.current.phoneNumberId = signupData.phone_number_id;
            signupSessionRef.current.wabaId = signupData.waba_id;
            signupSessionRef.current.businessId = signupData.business_id;
            signupSessionRef.current.onboarding = data.event === "FINISH" ? "cloud" : "coexistence";

            // So conclui com o code do FB.login tambem; sem ele, espera o callback.
            if (signupSessionRef.current.code) settleSignup();
          } else if (data.event === "CANCEL") {
            if (signupSessionRef.current.reject) {
              signupSessionRef.current.reject(new Error("Conexão cancelada pelo usuário no popup da Meta."));
              signupSessionRef.current.reject = undefined;
              signupSessionRef.current.resolve = undefined;
            }
            setIsSigningUp(false);
          }
        }
      } catch {
        // Ignora mensagens de outras fontes que não são JSON
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [settleSignup]);

  const launchSignup = useCallback(
    (options?: MetaEmbeddedSignupOptions): Promise<MetaEmbeddedSignupResult> => {
      setIsSigningUp(true);

      return new Promise<MetaEmbeddedSignupResult>((resolve, reject) => {
        signupSessionRef.current = {
          resolve,
          reject,
        };

        // Se não houver chaves da Meta configuradas no ambiente, resolve com vazio para fallback
        if (!appId || !configId) {
          setIsSigningUp(false);
          resolve({});
          return;
        }

        // A Meta exige estritamente HTTPS para invocar o popup de login/onboarding
        if (typeof window !== "undefined" && window.location.protocol !== "https:") {
          setIsSigningUp(false);
          reject(
            new Error(
              "A Meta exige HTTPS para abrir a conexão do WhatsApp. Acesse via HTTPS local (rode `pnpm dev:https` ou `pnpm tunnel`).",
            ),
          );
          return;
        }

        if (!window.FB) {
          setIsSigningUp(false);
          reject(
            new Error(
              "O SDK do Facebook ainda está carregando. Aguarde alguns instantes ou recarregue a página.",
            ),
          );
          return;
        }

        const localPhone = extractBrazilianLocalPhone(options?.phone);
        const setupPayload: Record<string, unknown> = {
          business: {
            ...(options?.businessName ? { name: options.businessName } : {}),
            ...(options?.email ? { email: options.email } : {}),
            address: {
              country: "BR",
            },
            country: "BR",
            timezone: "America/Sao_Paulo",
          },
          phone: {
            code: 55,
            ...(localPhone ? { number: localPhone } : {}),
            ...(options?.businessName ? { wa_profile_name: options.businessName } : {}),
          },
        };

        try {
          window.FB.login(
            (response) => {
              const code = response.authResponse?.code;
              signupSessionRef.current.code = code;

              if (response.status === "connected" || code) {
                // O aviso de conclusao (numero e conta) pode chegar depois do
                // callback: conclui ja se chegou, senao espera ate FINISH_WAIT_MS.
                if (signupSessionRef.current.wabaId) {
                  settleSignup();
                } else {
                  setTimeout(settleSignup, FINISH_WAIT_MS);
                }
              } else {
                setIsSigningUp(false);
                reject(new Error("Acesso não autorizado na janela da Meta."));
              }
            },
            {
              config_id: configId,
              response_type: "code",
              override_default_response_type: true,
              locale: "pt_BR",
              extras: {
                setup: setupPayload,
                featureType: "whatsapp_business_app_onboarding",
                sessionInfoVersion: "3",
              },
            },
          );
        } catch (err) {
          setIsSigningUp(false);
          logError("[Meta Embedded Signup] Erro ao abrir FB.login:", err);
          reject(err instanceof Error ? err : new Error("Erro ao abrir janela de conexão da Meta."));
        }
      });
    },
    [appId, configId, settleSignup],
  );

  return {
    isConfigured: Boolean(appId && configId),
    isSdkLoaded,
    isSigningUp,
    launchSignup,
  };
}
