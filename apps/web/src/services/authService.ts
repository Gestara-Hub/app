// MOCKED authentication service (see docs/frontend/02-camada-de-dados-mock.md).
// Volatile session in localStorage; swapping for a real API = swap only this
// implementation.

export interface Session {
  userId: string
  name: string
  role: 'admin'
  organizationId: string
  unitId: string
}

const STORAGE_KEY = 'gestarahub.sessao'

// Logged-in MVP user = owner/admin of Corte Nobre (see docs/product/06 and 08).
const MOCK_SESSION: Session = {
  userId: 'u-marcelo',
  name: 'Marcelo Andrade',
  role: 'admin',
  organizationId: 'org-corte-nobre',
  unitId: 'un-matriz',
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export const authService = {
  getSession(): Session | null {
    if (!isBrowser()) return null
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Session
    } catch {
      return null
    }
  },
  login(): Session {
    if (isBrowser()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_SESSION))
    }
    return MOCK_SESSION
  },
  logout(): void {
    if (isBrowser()) {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  },
}
