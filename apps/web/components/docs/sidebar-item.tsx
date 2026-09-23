"use client";

import { useMemo } from "react";
import { usePathname } from "fumadocs-core/framework";
import { SidebarItem, useFolderDepth } from "fumadocs-ui/components/sidebar/base";
import { cn } from "@/lib/utils";
import { useStatusMap } from "./status-context";
import { StatusBadge } from "./status-badge";
import type { Item } from "fumadocs-core/page-tree";

function getItemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

function isActive(href: string, pathname: string): boolean {
  const normalize = (u: string) => (u.length > 1 && u.endsWith("/") ? u.slice(0, -1) : u);
  const h = normalize(href);
  const p = normalize(pathname);
  return h === p || p.startsWith(`${h}/`);
}

export function StatusSidebarItem({ item }: { item: Item }) {
  const pathname = usePathname();
  const depth = useFolderDepth();
  const statusMap = useStatusMap();
  const status = statusMap.get(item.url);
  const active = isActive(item.url, pathname);

  const className = useMemo(
    () =>
      cn(
        "relative flex flex-row items-center gap-2 rounded-lg p-2 text-start",
        "text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0",
        "transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none",
        "data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary",
        "data-[active=true]:hover:transition-colors",
        depth >= 1 && [
          "data-[active=true]:before:content-['']",
          "data-[active=true]:before:bg-fd-primary",
          "data-[active=true]:before:absolute",
          "data-[active=true]:before:w-px",
          "data-[active=true]:before:inset-y-2.5",
          "data-[active=true]:before:inset-s-2.5"
        ]
      ),
    [depth]
  );

  return (
    <SidebarItem
      href={item.url}
      external={item.external}
      active={active}
      icon={item.icon}
      className={className}
      style={{ paddingInlineStart: getItemOffset(depth) }}
    >
      {item.name}
      {status && <StatusBadge status={status} className="ms-auto shrink-0" />}
    </SidebarItem>
  );
}
