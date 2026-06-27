import type { Service } from '@/types/service'
import { servicesSeed } from './seed'

// Store em memoria, volatil (reinicia no reload). Apenas os services tocam aqui.
interface Db {
  services: Service[]
}

export const db: Db = {
  services: structuredClone(servicesSeed),
}
