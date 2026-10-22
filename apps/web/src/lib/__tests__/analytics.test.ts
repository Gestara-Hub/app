import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_CONSENT_KEY, readAnalyticsConsent, writeAnalyticsConsent } from "../analytics-consent";

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  capture: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
  get_distinct_id: vi.fn(() => "anon-1"),
  get_property: vi.fn(() => "anonymous"),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

const ANA = { id: "usr-ana", profile: "owner", organizationId: "org-1" };

/** localStorage em memoria (o teste roda em Node). */
function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return data;
}

/** Modulo novo a cada teste (o estado "ligado" e do modulo), com ou sem chave. */
async function loadAnalytics(key: string | null = "phc_test") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key ?? "");
  return import("../analytics");
}

beforeEach(() => {
  vi.clearAllMocks();
  posthog.has_opted_out_capturing.mockReturnValue(false);
  posthog.get_distinct_id.mockReturnValue("anon-1");
  posthog.get_property.mockReturnValue("anonymous");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("analytics-consent", () => {
  it("lê, grava e apaga a escolha", () => {
    const data = stubStorage();
    expect(readAnalyticsConsent()).toBe("unset");
    writeAnalyticsConsent("granted");
    expect(data.get(ANALYTICS_CONSENT_KEY)).toBe("granted");
    expect(readAnalyticsConsent()).toBe("granted");
    writeAnalyticsConsent("unset");
    expect(data.has(ANALYTICS_CONSENT_KEY)).toBe(false);
  });

  it("valor desconhecido conta como sem escolha", () => {
    stubStorage({ [ANALYTICS_CONSENT_KEY]: "talvez" });
    expect(readAnalyticsConsent()).toBe("unset");
  });

  it("sem storage (bloqueado ou no server) não quebra", () => {
    expect(readAnalyticsConsent()).toBe("unset");
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("bloqueado");
        },
        setItem: () => {
          throw new Error("bloqueado");
        },
      },
    });
    expect(readAnalyticsConsent()).toBe("unset");
    expect(() => writeAnalyticsConsent("granted")).not.toThrow();
  });
});

describe("analytics", () => {
  it("sem chave no ambiente: não liga nem com aceite", async () => {
    stubStorage({ [ANALYTICS_CONSENT_KEY]: "granted" });
    const analytics = await loadAnalytics(null);
    expect(analytics.isAnalyticsConfigured).toBe(false);
    analytics.initAnalytics();
    analytics.identifyUser(ANA);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it("sem escolha: não liga e não identifica", async () => {
    stubStorage();
    const analytics = await loadAnalytics();
    analytics.initAnalytics();
    analytics.identifyUser(ANA);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it("aceitar liga e identifica quem já estava logado, só com id, perfil e organização", async () => {
    stubStorage();
    const analytics = await loadAnalytics();
    analytics.identifyUser(ANA);
    analytics.setAnalyticsConsent("granted");
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init.mock.calls[0][1]).toMatchObject({
      session_recording: { maskAllInputs: true, maskTextSelector: "[data-analytics-mask]" },
    });
    expect(posthog.identify).toHaveBeenCalledTimes(1);
    expect(posthog.identify).toHaveBeenCalledWith("usr-ana", { profile: "owner", organizationId: "org-1" });
  });

  it("recusar depois de ligado para a captura; aceitar de novo retoma", async () => {
    stubStorage({ [ANALYTICS_CONSENT_KEY]: "granted" });
    const analytics = await loadAnalytics();
    analytics.initAnalytics();
    analytics.setAnalyticsConsent("denied");
    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    analytics.setAnalyticsConsent("granted");
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it("recusa guardada pelo PostHog numa visita anterior: o aceite reativa a captura", async () => {
    stubStorage({ [ANALYTICS_CONSENT_KEY]: "granted" });
    posthog.has_opted_out_capturing.mockReturnValue(true);
    const analytics = await loadAnalytics();
    analytics.initAnalytics();
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
  });

  it("outra pessoa no mesmo navegador: reinicia a identidade antes de identificar", async () => {
    stubStorage({ [ANALYTICS_CONSENT_KEY]: "granted" });
    const analytics = await loadAnalytics();
    analytics.initAnalytics();
    posthog.get_distinct_id.mockReturnValue("usr-carlos");
    posthog.get_property.mockReturnValue("identified");
    analytics.identifyUser(ANA);
    expect(posthog.reset).toHaveBeenCalledTimes(1);
    expect(posthog.identify).toHaveBeenCalledWith("usr-ana", expect.any(Object));
  });

  it("rever a escolha apaga a resposta (o aviso volta)", async () => {
    const data = stubStorage({ [ANALYTICS_CONSENT_KEY]: "denied" });
    const analytics = await loadAnalytics();
    analytics.reviewAnalyticsConsent();
    expect(data.has(ANALYTICS_CONSENT_KEY)).toBe(false);
  });
});

describe("trackEvent", () => {
  it("só envia depois do aceite", async () => {
    stubStorage();
    const analytics = await loadAnalytics();
    analytics.trackEvent("landing_signup_cta_clicked", { placement: "hero" });
    expect(posthog.capture).not.toHaveBeenCalled();
    analytics.setAnalyticsConsent("granted");
    analytics.trackEvent("landing_signup_cta_clicked", { placement: "hero" });
    expect(posthog.capture).toHaveBeenCalledWith("landing_signup_cta_clicked", { placement: "hero" });
  });

  it("sem chave não envia nada", async () => {
    stubStorage({ [ANALYTICS_CONSENT_KEY]: "granted" });
    const analytics = await loadAnalytics(null);
    analytics.setAnalyticsConsent("granted");
    analytics.trackEvent("landing_section_viewed", { section: "online_payments" });
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
