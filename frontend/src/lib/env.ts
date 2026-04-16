export function getBackendUrl(): string {
  const raw = import.meta.env.VITE_BACKEND_URL;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("VITE_BACKEND_URL must be set (see .env.example)");
  }
  return raw.replace(/\/+$/, "");
}
