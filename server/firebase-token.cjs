const { createPublicKey, verify } = require('node:crypto');
let cachedKeys = null;
let expires = 0;
async function verifyFirebaseToken(token, projectId, fetcher = fetch) {
  if (typeof token !== 'string' || token.length > 10000) throw new Error('invalid-token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid-token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const now = Math.floor(Date.now()/1000);
  if (header.alg !== 'RS256' || !header.kid || claims.aud !== projectId || claims.iss !== 'https://securetoken.google.com/'+projectId ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 || !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now+60) throw new Error('invalid-token');
  if (!cachedKeys || Date.now() >= expires || !cachedKeys.some(key=>key.kid===header.kid)) {
    const response = await fetcher('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', {signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('auth-unavailable');
    cachedKeys = (await response.json()).keys;
    expires = Date.now()+3600000;
  }
  const jwk = cachedKeys.find(key=>key.kid===header.kid);
  if (!jwk || !verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url'))) throw new Error('invalid-token');
  return claims;
}
module.exports = { verifyFirebaseToken };
