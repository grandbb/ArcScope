import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const appUrl = configuredAppUrl || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "AScope - Arc Network intelligence", template: "%s | AScope" },
  description: "Arc-first portfolio tracking and real-time on-chain analytics, powered by native USDC data.",
  icons: { icon: "/ascope-icon.png", apple: "/ascope-icon.png" },
  openGraph: { title: "AScope - Arc Network intelligence", description: "Explore Arc Network activity, stable USDC fees, and wallet analytics.", images: [{ url: "/og.png", width: 1536, height: 864, alt: "AScope — Arc Network Intelligence" }] },
  twitter: { card: "summary_large_image", title: "AScope - Arc Network intelligence", description: "Explore Arc Network activity, stable USDC fees, and wallet analytics.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className={`${inter.variable} ${mono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}><Providers>{children}</Providers></body></html>;
}
