import "server-only";
import { sql } from "./db";

/**
 * Limite de tentativas (login e codigo do 2FA). Diferente do app dos clientes,
 * aqui falha FECHADO: se o banco nao responde, a tentativa e recusada.
 */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const rows = await sql()<{ ok: boolean }[]>`select platform.check_rate_limit(${key}, ${max}, ${windowSeconds}) as ok`;
    return Boolean(rows[0]?.ok);
  } catch {
    return false;
  }
}

export async function reset(key: string): Promise<void> {
  try {
    await sql()`select platform.reset_rate_limit(${key})`;
  } catch {
    // Limpar o contador e opcional.
  }
}
