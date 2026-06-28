import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Inter } from "next/font/google";
import { Metadata } from "next";

const inter = Inter({
  subsets: ["latin"]
});

// Complete SEO Configuration
export const metadata: Metadata = {
  title: {
    default: "Blockend — Modular, Type-Safe Backend Code Blocks",
    template: "%s | Blockend"
  },
  description:
    "An open-source CLI tool to inject clean, production-ready, and type-safe TypeScript backend blocks directly into your codebase. You own your code.",
  keywords: [
    "Blockend",
    "Backend Registry",
    "TypeScript Backend",
    "Next.js Backend",
    "Hono CLI",
    "Fastify Components",
    "Type-safe Backend",
    "Zod Validation",
    "Open Source Developer Tools"
  ],
  authors: [{ name: "Noor ul hassan" }],
  metadataBase: new URL("https://blockend.noorulhassan.com"),

  // Open Graph (LinkedIn, Facebook, Discord)
  openGraph: {
    title: "Blockend — Modular, Type-Safe Backend Code Blocks",
    description:
      "Stop installing heavy node_modules wrappers. Ingest clean, framework-agnostic TypeScript backend layers right into your workspace via CLI.",
    url: "https://blockend.noorulhassan.com",
    siteName: "Blockend",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png", // Make sure to place an og-image.png in your public/ directory
        width: 1200,
        height: 630,
        alt: "Blockend Open Source Framework"
      }
    ]
  },

  // Twitter / X Cards
  twitter: {
    card: "summary_large_image",
    title: "Blockend — Modular, Type-Safe Backend Code Blocks",
    description:
      "Inject clean, production-ready backend code blocks directly into your codebase. Absolute code ownership.",
    images: ["/og-image.png"]
  },

  // Standard Robots & Icons configuration
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png"
  }
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
