import type { Metadata } from "next";
import { Inter, Archivo, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const thescoreFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-thescore",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PLAIONN Hockey",
  robots: { index: false, follow: false },
  description: "Your league, your teams, and every moment on the ice.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable} ${thescoreFont.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
