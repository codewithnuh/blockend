"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface GithubStarBannerProps {
  /** Optional star count to show live social proof */
  starCount?: string | number;
}

export function GithubStarBanner({ starCount }: GithubStarBannerProps) {
  return (
    <Card className="group relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-background to-background p-3 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
      {/* Subtle accent line */}
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-amber-500 rounded-l-xl" />

      <div className="container mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* GitHub icon container */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/80 text-foreground transition-transform group-hover:scale-105"
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 008.01 10.94c.585.11.798-.254.798-.566 0-.28-.01-1.02-.016-2.002-3.258.708-3.946-1.57-3.946-1.57-.533-1.354-1.302-1.715-1.302-1.715-1.065-.728.08-.713.08-.713 1.178.083 1.798 1.209 1.798 1.209 1.046 1.793 2.744 1.275 3.413.975.106-.758.41-1.275.745-1.568-2.6-.296-5.336-1.3-5.336-5.786 0-1.278.456-2.323 1.203-3.142-.12-.295-.521-1.486.115-3.097 0 0 .982-.314 3.217 1.2A11.18 11.18 0 0112 6.17a11.18 11.18 0 012.93.394c2.235-1.514 3.216-1.2 3.216-1.2.637 1.611.236 2.802.116 3.097.748.819 1.202 1.864 1.202 3.142 0 4.497-2.74 5.487-5.348 5.777.42.362.794 1.077.794 2.172 0 1.568-.014 2.833-.014 3.218 0 .314.21.681.803.565A11.5 11.5 0 0023.5 12C23.5 5.648 18.352.5 12 .5z"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Enjoying Blockend?</p>

              <p className="text-xs text-muted-foreground">
                <span className="hidden sm:inline">
                  Help us grow by giving standard support on GitHub.
                </span>
                <span className="sm:hidden">Give us a star on GitHub</span>
              </p>
            </div>
          </div>

          <Button
            asChild
            size="sm"
            className="h-9 shrink-0 gap-2 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background shadow-sm hover:bg-foreground/90 transition-all active:scale-95"
          >
            <Link
              href="https://github.com/codewithnuh/blockend"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Star Blockend on GitHub (opens in a new tab)"
            >
              <Star
                className="h-3.5 w-3.5 fill-amber-400 text-amber-400 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
                aria-hidden="true"
              />
              <span>Star on GitHub</span>
              {starCount !== undefined && (
                <span className="ml-1 rounded-md bg-background/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider">
                  {starCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
