"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    code?: string;
  }>({});

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

            // Se o code também já foi capturado pelo callback do FB.login, resolve agora
            if (signupSessionRef.current.resolve) {
              signupSessionRef.current.resolve({
                code: signupSessionRef.current.code,
                phoneNumberId: signupSessionRef.current.phoneNumberId,
                wabaId: signupSessionRef.current.wabaId,
                businessId: signupSessionRef.current.businessId,
              });
              signupSessionRef.current.resolve = undefined;
            }
          } else if (data.event === "CANCEL") {
            if (signupSessionRef.current.reject) {
              signupSessionRef.current.reject(new Error("Conexão cancelada pelo usuário no popup da Meta."));
              signupSessionRef.current.reject = undefined;
            }
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
  }, []);

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

              // Se já recebeu o evento message do popup ou se recebeu code
              if (response.status === "connected" || code) {
                setTimeout(() => {
                  if (signupSessionRef.current.resolve) {
                    signupSessionRef.current.resolve({
                      code: signupSessionRef.current.code,
                      phoneNumberId: signupSessionRef.current.phoneNumberId,
                      wabaId: signupSessionRef.current.wabaId,
                      businessId: signupSessionRef.current.businessId,
                    });
                    signupSessionRef.current.resolve = undefined;
                  }
                  setIsSigningUp(false);
                }, 500);
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
    [appId, configId],
  );

  return {
    isConfigured: Boolean(appId && configId),
    isSdkLoaded,
    isSigningUp,
    launchSignup,
  };
}
