// Servico de autenticacao MOCKADO (ver docs/frontend/02-camada-de-dados-mock.md).
// Sessao volatil em localStorage; trocar por API real = trocar so esta implementacao.

export interface Sessao {
  usuarioId: string
  nome: string
  perfil: 'admin'
  organizacaoId: string
  unidadeId: string
}

const STORAGE_KEY = 'gestarahub.sessao'

// Usuario logado do MVP = proprietario/admin da Corte Nobre (ver docs/product/06 e 08).
const SESSAO_MOCK: Sessao = {
  usuarioId: 'u-marcelo',
  nome: 'Marcelo Andrade',
  perfil: 'admin',
  organizacaoId: 'org-corte-nobre',
  unidadeId: 'un-matriz',
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export const authService = {
  getSession(): Sessao | null {
    if (!isBrowser()) return null
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Sessao
    } catch {
      return null
    }
  },
  login(): Sessao {
    if (isBrowser()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SESSAO_MOCK))
    }
    return SESSAO_MOCK
  },
  logout(): void {
    if (isBrowser()) {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  },
}
