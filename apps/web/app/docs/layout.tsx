import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";
import { GithubStarBanner } from "@/components/globals/GithubStarBanner";
import { getStatusMap } from "@/lib/doc-status";
import { StatusProvider } from "@/components/docs/status-context";
import { StatusSidebarItem } from "@/components/docs/sidebar-item";

export default function Layout({ children }: LayoutProps<"/docs">) {
  const statusMap = getStatusMap(source);

  return (
    <StatusProvider statusMap={statusMap}>
      <GithubStarBanner />
      <DocsLayout
        tree={source.getPageTree()}
        {...baseOptions()}
        sidebar={{ components: { Item: StatusSidebarItem } }}
      >
        {children}
      </DocsLayout>
    </StatusProvider>
  );
}
