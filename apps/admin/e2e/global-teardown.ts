import { cleanupAll } from "./helpers";

export default async function globalTeardown() {
  await cleanupAll();
}
