import { cleanupAll } from "./helpers";

/** Apaga sobras de uma rodada interrompida antes de começar. */
export default async function globalSetup() {
  await cleanupAll();
}
