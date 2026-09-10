const VISITOR_KEY = "clm_visitor";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "anonymous";
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id =
      (crypto.randomUUID?.() as string | undefined) ??
      `v-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}
