import { readText, writeText } from "./storage";

const VISITOR_KEY = "clm_visitor";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "anonymous";
  let id = readText(VISITOR_KEY);
  if (!id) {
    id =
      (crypto.randomUUID?.() as string | undefined) ??
      `v-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    writeText(VISITOR_KEY, id);
  }
  return id;
}