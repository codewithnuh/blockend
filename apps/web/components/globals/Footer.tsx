import Link from "next/link";
import { FOOTER_LINKS } from "@/lib/data";

export function Footer() {
  return (
    <footer className="border-t border-border py-10 bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-mono text-xs text-muted-foreground">
          © 2026 blockend · MIT licensed · built by{" "}
          <Link
            href="https://github.com/codewithnuh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary transition-colors font-medium"
          >
            codewithnuh
          </Link>
        </p>

        <div className="flex items-center gap-5 text-xs font-mono text-muted-foreground">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors focus-ring"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
