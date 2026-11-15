/**
 * In pg 8, sslmode=prefer/require/verify-ca are aliases for verify-full.
 * pg 9 will change their meanings; make today's hostname-verification
 * semantics explicit without changing Neon configuration or logging secrets.
 *
 * Only rewrite documented legacy aliases. All other connection strings
 * retain their exact original bytes.
 */
export function normalizePostgresSslMode(connectionString) {
 if (typeof connectionString !== 'string') return connectionString;
 let url;
 try { url = new URL(connectionString); } catch { return connectionString; }
 if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return connectionString;
 if (!['prefer','require','verify-ca'].includes(url.searchParams.get('sslmode'))) return connectionString;
 url.searchParams.set('sslmode','verify-full');
 return url.toString();
}
