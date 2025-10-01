import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import SessionProv from "@/components/providers/session-provider";
import AuthLauncher from "@/components/auth-launcher";

export const metadata: Metadata = {
  title: "FluxCart",
  description: "Buy/Rent/Swap + Group-Buy",
};

const GITHUB_URL = "https://github.com/Kush146";
const BUILDER_NAME = "Kush Kore";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SessionProv>
          {/* Header */}
          <header className="sticky top-0 z-40 border-b border-brand-dark/60 bg-brand text-white shadow-sm">
            <div className="container mx-auto flex items-center gap-4 px-4 py-3">
              <Link href="/" className="text-lg font-bold tracking-tight">
                FluxCart
              </Link>

              <nav className="flex items-center gap-4 text-sm">
                <Link href="/shop" className="hover:underline/70">
                  Shop
                </Link>
                <Link href="/cart" className="hover:underline/70">
                  Cart
                </Link>
                <Link href="/orders" className="hover:underline/70">
                  Orders
                </Link>
                {/* Removed the left-side Account link */}
              </nav>

              {/* Auth launcher (shows “Account” when signed in) */}
              <div className="ml-auto">
                <AuthLauncher />
              </div>

              {/* Removed the GitHub button in the header */}
            </div>
          </header>

          {/* Main */}
          <main className="container mx-auto px-4 py-4">{children}</main>

          {/* Footer */}
          <footer className="border-t border-brand-dark/30 bg-brand-dark text-white">
            <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-4 text-sm md:flex-row">
              <div className="text-white/90">
                Website built by{" "}
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-brand-accent"
                >
                  {BUILDER_NAME}
                </a>
              </div>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 hover:bg-white/15"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 0 0-3.16 19.48c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.2-3.37-1.2c-.45-1.17-1.1-1.48-1.1-1.48c-.9-.62.07-.61.07-.61c.99.07 1.5 1.02 1.5 1.02c.89 1.52 2.34 1.08 2.9.83c.09-.64.35-1.08.63-1.33c-2.22-.25-4.56-1.11-4.56-4.95c0-1.09.39-1.98 1.02-2.68c-.1-.25-.44-1.26.1-2.63c0 0 .83-.27 2.72 1.02c.79-.22 1.64-.33 2.49-.33c.85 0 1.7.11 2.49.33c1.89-1.29 2.72-1.02 2.72-1.02c.54 1.37.2 2.38.1 2.63c.63.7 1.02 1.59 1.02 2.68c0 3.85-2.34 4.7-4.57 4.95c.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
                  />
                </svg>
                View Source
              </a>
            </div>
          </footer>

          <Toaster richColors position="top-right" />
        </SessionProv>
      </body>
    </html>
  );
}
