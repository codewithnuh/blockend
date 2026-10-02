import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/globals/Footer";
import { getRecipe, loadRecipes } from "@/lib/recipes";

interface RecipePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const recipes = await loadRecipes();
  return recipes.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe) return { title: "Recipe not found" };
  return { title: recipe.title, description: recipe.outcome };
}

export default async function RecipeDetailPage({ params }: RecipePageProps) {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe) notFound();

  return (
    <>
      <div className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/recipes"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-fg hover:underline dark:text-fog dark:hover:text-paper"
        >
          ← All recipes
        </Link>

        <header className="mt-10 border-b border-border pb-10 dark:border-graphite">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Blockend recipe
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-tight text-fg dark:text-paper sm:text-5xl">
            {recipe.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground dark:text-fog">
            {recipe.outcome}
          </p>
        </header>

        <div className="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-12">
            <section aria-labelledby="architecture-heading">
              <SectionHeading id="architecture-heading">Architecture</SectionHeading>
              <p className="mt-4 text-sm leading-7 text-muted-foreground dark:text-fog">
                {recipe.architecture.overview}
              </p>
              {recipe.architecture.components.length > 0 && (
                <ul className="mt-5 space-y-3">
                  {recipe.architecture.components.map((component) => (
                    <li
                      key={`${component.name}-${component.block ?? "component"}`}
                      className="rounded-card border border-border bg-surface p-4 dark:border-graphite dark:bg-carbon"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium text-fg dark:text-paper">{component.name}</h3>
                        {component.block && (
                          <code className="font-mono text-xs text-muted-foreground dark:text-ash">
                            {component.block}
                          </code>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-fog">
                        {component.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="order-heading">
              <SectionHeading id="order-heading">Integration order</SectionHeading>
              <ol className="mt-4 space-y-2">
                {recipe.integrationOrder.map((block, index) => (
                  <li
                    key={block}
                    className="flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 dark:border-graphite dark:bg-carbon"
                  >
                    <span className="font-mono text-xs text-muted-foreground dark:text-ash">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <code className="font-mono text-sm text-fg dark:text-paper">{block}</code>
                    {recipe.optionalBlocks.includes(block) && (
                      <span className="ml-auto text-xs text-muted-foreground dark:text-ash">
                        optional
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            {recipe.commands.length > 0 && (
              <section aria-labelledby="commands-heading">
                <SectionHeading id="commands-heading">Add the blocks</SectionHeading>
                <div className="mt-4 space-y-3">
                  {recipe.commands.map(({ label, command }) => (
                    <div
                      key={`${label}-${command}`}
                      className="rounded-card border border-border bg-surface p-4 dark:border-graphite dark:bg-carbon"
                    >
                      <p className="mb-2 text-xs text-muted-foreground dark:text-ash">{label}</p>
                      <pre className="overflow-x-auto font-mono text-sm text-fg dark:text-paper">
                        <code>{command}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="tradeoffs-heading">
              <SectionHeading id="tradeoffs-heading">Tradeoffs</SectionHeading>
              {recipe.tradeoffs.length ? (
                <ul className="mt-4 space-y-3">
                  {recipe.tradeoffs.map(({ choice, tradeoff }) => (
                    <li
                      key={choice}
                      className="rounded-card border border-border bg-surface p-4 dark:border-graphite dark:bg-carbon"
                    >
                      <h3 className="font-medium text-fg dark:text-paper">{choice}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-fog">
                        {tradeoff}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted-foreground dark:text-fog">
                  No tradeoffs are documented for this recipe yet.
                </p>
              )}
            </section>

            <section aria-labelledby="alternatives-heading">
              <SectionHeading id="alternatives-heading">Alternatives</SectionHeading>
              {recipe.alternatives?.length ? (
                <ul className="mt-4 space-y-3">
                  {recipe.alternatives.map(({ title, description }) => (
                    <li
                      key={title}
                      className="rounded-card border border-border bg-surface p-4 dark:border-graphite dark:bg-carbon"
                    >
                      <h3 className="font-medium text-fg dark:text-paper">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-fog">
                        {description}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted-foreground dark:text-fog">
                  No alternatives are documented for this recipe yet.
                </p>
              )}
            </section>

            {recipe.failureBehavior.length > 0 && (
              <section aria-labelledby="failure-heading">
                <SectionHeading id="failure-heading">Failure behavior</SectionHeading>
                <dl className="mt-4 space-y-4">
                  {recipe.failureBehavior.map(({ scenario, behavior }) => (
                    <div key={scenario}>
                      <dt className="font-medium text-fg dark:text-paper">{scenario}</dt>
                      <dd className="mt-1 text-sm leading-6 text-muted-foreground dark:text-fog">
                        {behavior}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>

          <aside className="space-y-8">
            <section aria-labelledby="includes-heading">
              <SectionHeading id="includes-heading">Included blocks</SectionHeading>
              <ul className="mt-3 flex flex-wrap gap-2">
                {recipe.includedBlocks.map((block) => (
                  <li
                    key={block}
                    className="rounded-badge border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-fg dark:border-graphite dark:bg-obsidian dark:text-paper"
                  >
                    {block}
                  </li>
                ))}
              </ul>
              {recipe.optionalBlocks.length > 0 && (
                <>
                  <h3 className="mt-5 text-sm font-medium text-fg dark:text-paper">
                    Optional additions
                  </h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {recipe.optionalBlocks.map((block) => (
                      <li
                        key={block}
                        className="rounded-badge border border-border px-2 py-1 font-mono text-xs text-muted-foreground dark:border-graphite dark:text-fog"
                      >
                        {block}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {recipe.assumptions.length > 0 && (
              <section aria-labelledby="assumptions-heading">
                <SectionHeading id="assumptions-heading">Assumptions</SectionHeading>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground dark:text-fog">
                  {recipe.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </section>
            )}

            {recipe.configuration.length > 0 && (
              <section aria-labelledby="configuration-heading">
                <SectionHeading id="configuration-heading">Configuration</SectionHeading>
                <dl className="mt-3 space-y-4">
                  {recipe.configuration.map((item) => (
                    <div key={item.name}>
                      <dt className="font-mono text-xs text-fg dark:text-paper">
                        {item.name} {item.required ? "(required)" : "(optional)"}
                      </dt>
                      <dd className="mt-1 text-xs leading-5 text-muted-foreground dark:text-fog">
                        {item.description}
                        {item.default && <span className="block">Default: {item.default}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {recipe.relatedContent.length > 0 && (
              <section aria-labelledby="related-heading">
                <SectionHeading id="related-heading">Related content</SectionHeading>
                <ul className="mt-3 space-y-2">
                  {recipe.relatedContent.map(({ title, href }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {title} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
      <Footer />
    </>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-medium tracking-tight text-fg dark:text-paper">
      {children}
    </h2>
  );
}
