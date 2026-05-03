import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/common/product-card";
import { PageContainer } from "@/components/layout/page-container";
import { routing, type Locale } from "@/i18n/routing";
import { categoryDisplayName } from "@/lib/category-display";
import { listProducts } from "@/lib/server/paperbase";
import { getStorefrontCategoryBySlug } from "@/lib/products";

type CategoryPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [tCategories, category, products] = await Promise.all([
    getTranslations("categories"),
    getStorefrontCategoryBySlug(slug),
    listProducts({ category: slug }),
  ]);

  const description = typeof category.description === "string" ? category.description.trim() : "";
  const hasProducts = products.results.length > 0;

  return (
    <div className="flex flex-1 flex-col bg-card pt-4 pb-8 md:pt-6 md:pb-10">
      <PageContainer>
        <header className="mx-auto max-w-4xl px-1 text-center">
          <h1 className="text-pretty text-2xl font-light tracking-tight text-foreground md:text-3xl lg:text-4xl">
            {categoryDisplayName(category.name)}
          </h1>
          {description ? (
            <p className="mx-auto mt-3 max-w-3xl text-pretty text-base font-normal leading-snug text-foreground/85 md:mt-4 md:text-lg md:leading-relaxed">
              {description}
            </p>
          ) : null}
        </header>

        {hasProducts ? (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-6 md:mt-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.results.map((product, productIdx) => (
              <ProductCard
                key={product.public_id}
                locale={locale as Locale}
                aosDelay={(productIdx + 1) * 100}
                product={{
                  ...product,
                  extra_data: product.extra_data ?? {},
                }}
              />
            ))}
          </div>
        ) : (
          <p className="card mx-auto mt-5 max-w-lg text-center text-sm text-foreground/80 md:mt-6">
            {tCategories("noProducts")}
          </p>
        )}
      </PageContainer>
    </div>
  );
}
