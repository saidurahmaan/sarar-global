import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BlogHero } from "@/components/blog/blog-hero";
import { BlogListing } from "@/components/blog/blog-listing";
import { PageContainer } from "@/components/layout/page-container";
import { routing, type Locale } from "@/i18n/routing";
import { getAllPosts } from "@/lib/blog-data";
import { DOCUMENT_METADATA_LOCALE } from "@/lib/document-metadata-locale";
import { resolveStorefrontDocumentBrand } from "@/lib/storefront";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    return {};
  }

  const [t, brand] = await Promise.all([
    getTranslations({ locale: DOCUMENT_METADATA_LOCALE, namespace: "blog" }),
    resolveStorefrontDocumentBrand(),
  ]);

  return {
    title: `${t("metaTitle")} - ${brand}`,
    description: t("metaDescription"),
  };
}

export default async function BlogPage({ params }: PageProps) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const [t, posts] = await Promise.all([
    getTranslations({ locale, namespace: "blog" }),
    getAllPosts(),
  ]);
  const featuredPosts = posts.filter((post) => post.featured === true).slice(0, 4);
  const featuredSlugs = new Set(featuredPosts.map((post) => post.slug));
  const latestPosts = posts.filter((post) => !featuredSlugs.has(post.slug)).slice(0, 4);

  return (
    <div className="bg-card pb-12 pt-8 md:pb-16 md:pt-10">
      <PageContainer>
        <BlogHero badge={t("badge")} title={t("heroTitle")} intro={t("heroIntro")} />
        <BlogListing
          posts={posts}
          featuredPosts={featuredPosts}
          latestPosts={latestPosts}
          sectionTitle={t("sectionTitle")}
          featuredHeading={t("featuredHeading")}
          latestHeading={t("latestHeading")}
          searchPlaceholder={t("searchPlaceholder")}
          searchButtonLabel={t("searchButton")}
          emptySearch={t("emptySearch")}
        />
      </PageContainer>
    </div>
  );
}
