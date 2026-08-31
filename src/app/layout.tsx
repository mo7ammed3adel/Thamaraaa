import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { getDirection } from "@/lib/i18n/config";
import { getLocale } from "@/server/i18n/locale";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Geist carries no Arabic glyphs, so Arabic used to fall back to Arial — thin,
// cramped and hard to read at the sizes this UI uses. IBM Plex Sans Arabic is
// drawn for interfaces and keeps its shape down to small label sizes.
const arabicSans = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thamaraa ERP",
  description: "Thamaraa operations & CRM platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Decided on the server so the very first paint is already in the reader's
  // language and reading direction — no flash of the wrong one.
  const locale = getLocale();

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${arabicSans.variable} antialiased min-h-screen bg-gray-50 text-gray-900`}
      >
        <Providers locale={locale}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
