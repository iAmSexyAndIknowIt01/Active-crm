import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content Security Policy: зөвхөн өөрийн домэйноос script, style, зураг, холболт зөвшөөрнө.
// Next.js inline script ашигладаг тул 'unsafe-inline' шаардлагатай; dev-ийн HMR-д 'unsafe-eval' болон ws.
// frame-ancestors 'none' — сайтыг өөр хуудсанд iframe-ээр оруулах (clickjacking)-аас хамгаална.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HTTPS-ийг 2 жил албадна (зөвхөн production; localhost-д нөлөөлөхгүйн тулд)
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // "X-Powered-By: Next.js" header-ээр ашигласан технологийг ил болгохгүй
  poweredByHeader: false,
  // Эх хавтсанд (C:\Users\tekeb) өөр package-lock.json байсан ч төслийн root-ыг энэ хавтас гэж тогтооно
  turbopack: {
    root: path.join(__dirname),
  },
  // Хуучин "Open Data" брэндийн анкетын холбоос (QR код, хуваалцсан линк)-ууд ажилласаар байхаар шинэ зам руу шилжүүлнэ
  async redirects() {
    return [
      { source: "/open-data/:path*", destination: "/active-crm/:path*", permanent: true },
      { source: "/api/open-data/:path*", destination: "/api/active-crm/:path*", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
