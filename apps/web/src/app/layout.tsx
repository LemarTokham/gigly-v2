import type { Metadata, Viewport } from "next";
import { Archivo, Bowlby_One } from "next/font/google";
import "./globals.css";
import { TabBar } from "@/components/tab-bar";
import { Toaster } from "@/components/toaster";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

// Bowlby One ships a single weight. It is the display face on every heading.
const bowlby = Bowlby_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bowlby",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Gigly — small gigs in Liverpool",
    template: "%s — Gigly",
  },
  description:
    "What's on in Liverpool's small rooms, and who's worth turning up for. Back a local artist with a hype.",
  applicationName: "Gigly",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // opts the page into the safe-area insets the token layer relies on
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F1EE" },
    { media: "(prefers-color-scheme: dark)", color: "#18121F" },
  ],
};

export default function RootLayout({
  children,
  sheet,
}: Readonly<{ children: React.ReactNode; sheet: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className={`${archivo.variable} ${bowlby.variable} antialiased`}>
        <div className="mx-auto max-w-[500px] px-4 pb-24">{children}</div>
        {sheet}
        <TabBar />
        <Toaster />
      </body>
    </html>
  );
}
