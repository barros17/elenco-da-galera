const KEY = "pelada-perfeita-session";

/** Identificador local da pelada, usado enquanto não há login. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
