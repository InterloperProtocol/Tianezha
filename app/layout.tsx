import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const display = IBM_Plex_Sans({
  variable: "--font-display",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tianezha",
  description:
    "Simulation-first identity, social, prediction, governance, and perp shell for Tianezha.",
  icons: {
    icon: [{ url: "/icon.jpg", type: "image/jpeg" }],
    shortcut: [{ url: "/icon.jpg", type: "image/jpeg" }],
    apple: [{ url: "/apple-icon.jpg", type: "image/jpeg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} seafoam-theme`}>
        {children}
      </body>
    </html>
  );
}
