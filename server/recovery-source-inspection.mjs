// Isolated GWAPOHOLICS recovery-only source inspection.
// Never returns DB hostnames, credentials, user IDs, stored player details or game data.
const expectedHost = "ep-empty-union-bcc2zwqc.c-16.us-east-1.aws.neon.tech";
export function inspectRecoverySource(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "missing_config";
  try {
    const url = new URL(raw);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return "invalid_config";
    const host = url.hostname.replace(/-pooler(?=\.)/, "");
    const db = decodeURIComponent(url.pathname.slice(1));
    return host === expectedHost && db === "neondb" ? "correct_isolated_source" : "wrong_database_source";
  } catch {
    return "invalid_config";
  }
}
