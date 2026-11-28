// The token from an "Authorization: Bearer" header. Tokens are 43 base64url characters; anything else is not worth
// a database lookup.
export function bearerToken(header: string | undefined): string | null {
  return header?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1] ?? null
}
