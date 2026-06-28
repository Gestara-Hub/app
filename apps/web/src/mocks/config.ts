/**
 * Configuracao central do comportamento simulado da camada mock.
 * Trocar o mock por backend real nao toca neste arquivo (some junto).
 */
export interface MockConfig {
  // Latencia aplicada em toda chamada de service (estados de carregando).
  latenciaMs: number;
  // Probabilidade [0..1] de injetar ApiError 'NETWORK' nas leituras (list/getById).
  // Em 0 desliga o erro aleatorio. Subir para exercitar o estado de erro (doc 10).
  taxaErroLeitura: number;
  // Persistir o store em localStorage (simula "banco"). No server/Node e no-op.
  // Desligar para testes que precisam de estado limpo.
  persistencia: boolean;
}

export const mockConfig: MockConfig = {
  latenciaMs: 350,
  taxaErroLeitura: 0,
  persistencia: true,
};
