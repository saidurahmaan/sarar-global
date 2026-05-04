import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BlogArticleBlocks } from "@/components/blog/blog-article-blocks";
import { BlogArticlePostNav } from "@/components/blog/blog-article-post-nav";
import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { BlogRelatedPosts } from "@/components/blog/blog-related-posts";
import { PageContainer } from "@/components/layout/page-container";
import { Link, routing, type Locale } from "@/i18n/routing";
import { storefrontImageUnoptimized } from "@/lib/storefront-image";
import {
  getAllSlugs,
  getArticleBlocks,
  getFeaturedPosts,
  getPostBySlug,
  getPrevNextPosts,
  getRelatedPosts,
  resolvePostTags,
} from "@/lib/blog-data";
import { formatBlogDateCompact } from "@/lib/blog-format";
import { resolveStorefrontDocumentBrand } from "@/lib/storefront";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams(): Promise<Array<{ locale: string; slug: string }>> {
  const slugs = await getAllSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    return {};
  }

  const post = await getPostBySlug(slug);
  if (!post) {
    return {};
  }

  const brand = await resolveStorefrontDocumentBrand();

  return {
    title: `${post.title} - ${brand}`,
    description: post.excerpt,
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const post = await getPostBySlug(slug);
  if (!post) {
    notFound();
  }

  const [t, blocks, { prev, next }, related] = await Promise.all([
    getTranslations({ locale, namespace: "blog" }),
    Promise.resolve(getArticleBlocks(post)),
    getPrevNextPosts(slug),
    getRelatedPosts(post.category, slug, 3),
  ]);

  const featuredPosts = (await getFeaturedPosts()).filter((p) => p.slug !== slug);

  const authorName = post.authorName ?? t("defaultAuthor");
  const dateLabel = formatBlogDateCompact(post.publishedAt, locale);
  const metaLine = t("metaLine", { date: dateLabel, name: authorName });
  const tags = resolvePostTags(post);

  return (
    <article className="bg-card pb-12 pt-8 md:pb-16 md:pt-10">
      <PageContainer>
        <nav aria-label={t("backToBlog")} className="mb-6 flex min-w-0 max-w-full items-center">
          <Link
            href="/blog"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            {t("backToBlog")}
          </Link>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="min-w-0">
            <header>
              <p className="text-sm text-muted-foreground">{metaLine}</p>
              <h1 className="mt-3 text-pretty text-2xl font-semibold tracking-tight text-foreground md:text-3xl lg:text-[2rem] lg:leading-tight">
                {post.title}
              </h1>
              <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">{post.excerpt}</p>
            </header>

            {post.imageUrl ? (
              <div className="mt-8 w-full overflow-hidden rounded-lg border border-border bg-muted">
                <div className="relative h-[260px] w-full sm:h-[340px] md:h-[420px] lg:h-[520px]">
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 960px"
                    className="object-contain"
                    unoptimized={storefrontImageUnoptimized(post.imageUrl)}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-10">
              <BlogArticleBlocks blocks={blocks} />
            </div>

            <BlogArticlePostNav
              prev={prev}
              next={next}
              prevLabel={t("prevArticle")}
              nextLabel={t("nextArticle")}
            />
          </div>

          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <BlogSidebar
              featuredHeading={t("featuredHeading")}
              featuredPosts={featuredPosts}
              locale={locale}
              showLatest={false}
            />
          </aside>
        </div>
      </PageContainer>

      <PageContainer>
        <BlogRelatedPosts posts={related} heading={t("moreFromTopic")} />
      </PageContainer>
    </article>
  );
}
