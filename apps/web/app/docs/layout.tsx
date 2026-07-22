import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";
import { GithubStarBanner } from "@/components/globals/GithubStarBanner";

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <>
      <GithubStarBanner />
      <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
        {children}
      </DocsLayout>
    </>
  );
}
