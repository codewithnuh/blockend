"use client";

import * as React from "react";
import Link from "next/link";
import { Sun, Moon, Menu, X } from "lucide-react";

import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/landing-constants";
import Image from "next/image";

interface NavbarProps {
  brand?: string;
  logoText?: string;
  githubUrl?: string;
  getStartedUrl?: string;
}

export function Navbar({
  brand = "Blockend",
  githubUrl = "https://github.com/noorulhassan/blockend",
  getStartedUrl = "#get-started"
}: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2">
          <div
            className="
            flex h-6 w-6 items-center justify-center
            rounded-md border bg-muted
            font-mono text-xs
          "
          >
            <Image src="/blockend-logo.png" alt="blockend" width={20} height={20} />
          </div>

          <span className="font-medium tracking-tight">{brand}</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className="
                text-sm text-muted-foreground
                transition-colors
                hover:text-foreground
              "
            >
              {item.text}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme */}
          <Button size="icon" variant="outline" onClick={toggleTheme} aria-label="Toggle theme">
            {!mounted ? (
              <span className="h-4 w-4" />
            ) : theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Github */}
          <Button variant="outline" className="hidden sm:flex gap-2 " asChild>
            <Link href={githubUrl} target="_blank" rel="noopener noreferrer">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 008.01 10.94c.585.11.798-.254.798-.566 0-.28-.01-1.02-.016-2.002-3.258.708-3.946-1.57-3.946-1.57-.533-1.354-1.302-1.715-1.302-1.715-1.065-.728.08-.713.08-.713 1.178.083 1.798 1.209 1.798 1.209 1.046 1.793 2.744 1.275 3.413.975.106-.758.41-1.275.745-1.568-2.6-.296-5.336-1.3-5.336-5.786 0-1.278.456-2.323 1.203-3.142-.12-.295-.521-1.486.115-3.097 0 0 .982-.314 3.217 1.2A11.18 11.18 0 0112 6.17a11.18 11.18 0 012.93.394c2.235-1.514 3.216-1.2 3.216-1.2.637 1.611.236 2.802.116 3.097.748.819 1.202 1.864 1.202 3.142 0 4.497-2.74 5.487-5.348 5.777.42.362.794 1.077.794 2.172 0 1.568-.014 2.833-.014 3.218 0 .314.21.681.803.565A11.5 11.5 0 0023.5 12C23.5 5.648 18.352.5 12 .5z"
                />
              </svg>
              Github
            </Link>
          </Button>

          {/* CTA */}
          <Button asChild className="hidden sm:flex bg-acid-lime text-black">
            <Link href={getStartedUrl}>Get Started</Link>
          </Button>

          {/* Mobile */}
          <Button
            size="icon"
            variant="outline"
            className="md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t bg-background p-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                onClick={() => setMobileMenuOpen(false)}
                className="
                  text-sm text-muted-foreground
                  hover:text-foreground
                "
              >
                {item.text}
              </Link>
            ))}

            <Button variant="outline" asChild>
              <Link href={githubUrl} target="_blank">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 008.01 10.94c.585.11.798-.254.798-.566 0-.28-.01-1.02-.016-2.002-3.258.708-3.946-1.57-3.946-1.57-.533-1.354-1.302-1.715-1.302-1.715-1.065-.728.08-.713.08-.713 1.178.083 1.798 1.209 1.798 1.209 1.046 1.793 2.744 1.275 3.413.975.106-.758.41-1.275.745-1.568-2.6-.296-5.336-1.3-5.336-5.786 0-1.278.456-2.323 1.203-3.142-.12-.295-.521-1.486.115-3.097 0 0 .982-.314 3.217 1.2A11.18 11.18 0 0112 6.17a11.18 11.18 0 012.93.394c2.235-1.514 3.216-1.2 3.216-1.2.637 1.611.236 2.802.116 3.097.748.819 1.202 1.864 1.202 3.142 0 4.497-2.74 5.487-5.348 5.777.42.362.794 1.077.794 2.172 0 1.568-.014 2.833-.014 3.218 0 .314.21.681.803.565A11.5 11.5 0 0023.5 12C23.5 5.648 18.352.5 12 .5z"
                  />
                </svg>
                Github
              </Link>
            </Button>
            <Button asChild className=" flex bg-acid-lime text-black">
              <Link href={getStartedUrl}>Get Started</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
