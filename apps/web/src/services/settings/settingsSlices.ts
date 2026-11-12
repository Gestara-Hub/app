import type { MethodSlice } from "../world/slices";

/**
 * Recortes das leituras que rodam em toda pagina (topo, barra de configuracao
 * inicial; 11/11/2026). Sem recorte, cada uma montava o espaco inteiro (doc 19).
 * Organizacao e unidade sao colecoes de uma linha: ja vem em todo recorte.
 */
const singlesOnly: MethodSlice = async () => {};

export const settingsSlices: Record<string, MethodSlice> = {
  getOrganization: singlesOnly,
  getUnit: singlesOnly,
};

/** Barra da configuracao inicial: so contagens dos cadastros, sem cobrancas nem presencas. */
export const onboardingSlices: Record<string, MethodSlice> = {
  getOnboardingSnapshot: async (_args, load) => {
    await Promise.all([
      load.all("professionals"),
      load.all("clients"),
      load.all("categories"),
      load.all("plans"),
      load.all("lessonPackages"),
      load.all("classGroups"),
      load.all("enrollments"),
    ]);
  },
};
