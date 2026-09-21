// Returns true if the address must be blocked (private/loopback/link-local/metadata).
// Used by safeFetch to prevent SSRF. Never throws.

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

const IPV4_BLOCKED: Array<[number, number]> = [
  // Each entry is [network, mask] as unsigned 32-bit integers.
  [ipv4ToInt("0.0.0.0"), 0xff000000 >>> 0],       // 0.0.0.0/8
  [ipv4ToInt("10.0.0.0"), 0xff000000 >>> 0],      // 10.0.0.0/8
  [ipv4ToInt("100.64.0.0"), 0xffc00000 >>> 0],    // 100.64.0.0/10 (shared address space)
  [ipv4ToInt("127.0.0.0"), 0xff000000 >>> 0],     // 127.0.0.0/8 loopback
  [ipv4ToInt("169.254.0.0"), 0xffff0000 >>> 0],   // 169.254.0.0/16 link-local + metadata
  [ipv4ToInt("172.16.0.0"), 0xfff00000 >>> 0],    // 172.16.0.0/12
  [ipv4ToInt("192.168.0.0"), 0xffff0000 >>> 0],   // 192.168.0.0/16
];

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return IPV4_BLOCKED.some(([net, mask]) => ((n & mask) >>> 0) === net);
}

// Strip the zone ID from a raw IPv6 address (e.g. "fe80::1%eth0" → "fe80::1")
function stripZoneId(ip: string): string {
  const pct = ip.indexOf("%");
  return pct === -1 ? ip : ip.slice(0, pct);
}

function isPrivateIpv6(ip: string): boolean {
  const addr = stripZoneId(ip).toLowerCase();
  if (addr === "::1" || addr === "0:0:0:0:0:0:0:1" || addr === "::" || addr === "0:0:0:0:0:0:0:0") return true; // loopback & unspecified
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // fc00::/7 ULA
  if (addr.startsWith("fe80")) return true;           // fe80::/10 link-local
  // IPv4-mapped IPv6: ::ffff:x.x.x.x — block if the embedded IPv4 is private
  const mapped = addr.match(/^(?:0:0:0:0:0:ffff:|::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped && mapped[1]) return isPrivateIpv4(mapped[1]);
  return false;
}

export function isPrivateIp(address: string): boolean {
  const clean = address.trim().replace(/^\[|\]$/g, "");
  // Heuristic: IPv4 addresses contain dots and no colons.
  if (clean.includes(":")) return isPrivateIpv6(clean);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(clean)) return isPrivateIpv4(clean);
  return false;
}

