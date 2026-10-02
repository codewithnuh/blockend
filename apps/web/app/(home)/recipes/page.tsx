import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/globals/Footer";
import { loadRecipes } from "@/lib/recipes";

export const metadata: Metadata = {
  title: "Backend recipes",
  description: "Production backend recipes built from Blockend source blocks."
};

export default async function RecipesPage() {
  const recipes = await loadRecipes();

  return (
    <>
      <div className="mx-auto min-h-[70vh] max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-12 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Recipe catalog
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-tight text-fg dark:text-paper sm:text-5xl">
            Backend systems, assembled with intent.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground dark:text-fog">
            Follow production-oriented recipes that explain how Blockend blocks fit together, what
            each choice means, and how to add the stack to your project.
          </p>
        </header>

        {recipes.length === 0 ? (
          <section className="rounded-card border border-border bg-surface p-8 dark:border-graphite dark:bg-carbon">
            <h2 className="text-xl font-medium text-fg dark:text-paper">Recipes are on the way</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground dark:text-fog">
              The catalog is ready for validated recipes. In the meantime, browse the available
              blocks and their setup guides.
            </p>
            <Link
              href="/docs/blocks-reference"
              className="mt-5 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Explore the block catalog →
            </Link>
          </section>
        ) : (
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <li key={recipe.slug}>
                <Link
                  href={`/recipes/${recipe.slug}`}
                  className="group flex h-full flex-col rounded-card border border-border bg-surface p-6 transition-colors hover:border-primary/50 dark:border-graphite dark:bg-carbon"
                >
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground dark:text-ash">
                    {recipe.includedBlocks.length} included blocks
                  </span>
                  <h2 className="mt-4 text-xl font-medium tracking-tight text-fg group-hover:text-primary dark:text-paper">
                    {recipe.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground dark:text-fog">
                    {recipe.outcome}
                  </p>
                  <span className="mt-auto pt-6 text-sm font-medium text-primary">
                    View recipe →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </>
  );
}
