export function appOrigin(value: string | undefined, production: boolean): string {
 if (!value) {
  if (!production) return "http://127.0.0.1:3000";
  throw new Error("Set NEXT_PUBLIC_APP_URL to the deployed HTTPS site origin.");
 }
 const url = new URL(value);
 if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
     !["https:", "http:"].includes(url.protocol)) throw new Error("APP_URL must be an origin without a path or credentials.");
 if (production && (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
  throw new Error("The deployed APP_URL must use public HTTPS, not localhost.");
 }
 return url.origin;
}
