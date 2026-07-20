export function getClientIp(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string
): string {
  // 1. Check standard proxy headers (if you trust your upstream proxy environment)
  const xForwardedFor = headers["x-forwarded-for"];
  if (xForwardedFor) {
    const ips =
      typeof xForwardedFor === "string" ? xForwardedFor.split(",") : xForwardedFor[0].split(",");

    return ips[0].trim(); // The first IP is the actual client
  }
  const xRealIp = headers["x-real-ip"];
  if (typeof xRealIp === "string") return xRealIp;
  // 2. Fall back to raw socket address
  return remoteAddress || "unknown-ip";
}
