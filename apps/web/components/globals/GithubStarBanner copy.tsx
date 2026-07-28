"use client";

import Link from "next/link";
import { useState } from "react";
import { Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function GithubStarBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <Card className="relative overflow-hidden border-amber-300 bg-linear-to-r from-amber-50 via-yellow-50 to-amber-100 px-3 py-2">
      <div className="container mx-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setVisible(false)}
          className="absolute right-2 top-1 h-6 w-6 text-amber-700 hover:bg-amber-200 hover:text-amber-900"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center justify-between gap-3 pr-7">
          <div className="flex min-w-0 items-center gap-2">
            <div className="rounded-md bg-amber-600 p-1.5 text-white">
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
            </div>

            <p className="truncate text-sm text-amber-900">
              Like Blockend? Give it a ⭐ on GitHub.
            </p>
          </div>

          <Button asChild size="sm" className="h-8 shrink-0 bg-amber-600 px-3 hover:bg-amber-700">
            <Link
              href="https://github.com/codewithnuh/blockend"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Star className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Star
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
