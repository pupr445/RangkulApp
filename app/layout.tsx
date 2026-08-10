import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RANGKUL — Manajemen Kerja Adaptif Multi-Sektor",
  description:
    "Satu platform manajemen kerja & komunikasi tim yang tampilannya menyesuaikan otomatis dengan sektor organisasimu.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-ink font-body antialiased">{children}</body>
    </html>
  );
}
