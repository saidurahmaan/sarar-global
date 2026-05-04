import type { Metadata } from "next";
import { BadgeCheck, ChevronRight, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ProductDetailAccordions } from "@/components/product/product-detail-accordions";
import { ProductDetailBuySection } from "@/components/product/product-detail-buy-section";
import { ProductDetailSkuRow } from "@/components/product/product-detail-sku-row";
import { ProductGallery } from "@/components/product/product-gallery";
import { VariantSelectionProvider } from "@/components/product/product-variant-selection";
import { StorefrontProductCard } from "@/components/common/StorefrontProductCard";
import { PageContainer } from "@/components/layout/page-container";
import { Link, routing, type Locale } from "@/i18n/routing";
import { categoryDisplayName } from "@/lib/category-display";
import { formatMoney, parseDecimal } from "@/lib/format";
import { buildProductGalleryImageUrls } from "@/lib/product-gallery";
import { buildProductExtraDetailLines, splitProductDescriptionBullets } from "@/lib/product-extra-fields";
import { DOCUMENT_METADATA_LOCALE } from "@/lib/document-metadata-locale";
import {
  getStorefrontProductDetail,
  getStorefrontProductSlugs,
} from "@/lib/products";
import { getStorefrontStorePublic } from "@/lib/storefront";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getStorefrontProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    return {};
  }

  const [product, store, tMeta] = await Promise.all([
    getStorefrontProductDetail(slug),
    getStorefrontStorePublic(),
    getTranslations({ locale: DOCUMENT_METADATA_LOCALE, namespace: "metadata" }),
  ]);
  if (!product) {
    return {};
  }

  const storeName = store.store_name?.trim() || tMeta("fallbackStoreName");
  return {
    title: `${product.name} - ${storeName}`,
    description: product.description || product.name,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const activeLocale = locale as Locale;

  const [product, store] = await Promise.all([
    getStorefrontProductDetail(slug),
    getStorefrontStorePublic(),
  ]);
  if (!product) {
    notFound();
  }

  const tDetail = await getTranslations({ locale: activeLocale, namespace: "productDetail" });
  const productName = product.name;
  const unitPrice = product.price;
  const discountPercent =
    product.original_price != null && parseDecimal(product.original_price) > 0
      ? Math.max(
          1,
          Math.round((1 - parseDecimal(product.price) / parseDecimal(product.original_price)) * 100),
        )
      : null;
  const descriptionBullets = splitProductDescriptionBullets(product.description ?? "");
  const extraDetailLines = buildProductExtraDetailLines(
    store.extra_field_schema,
    product.extra_data,
  );
  const hasDescription = descriptionBullets.length > 0;
  const hasExtras = extraDetailLines.length > 0;

  const accordionItems = [
    ...(hasDescription || !hasExtras
      ? [{ id: "product-details" as const, title: tDetail("sectionProductDetails"), body: "" }]
      : []),
    ...(hasExtras
      ? [{ id: "extra-details" as const, title: tDetail("sectionExtraDetails"), body: "" }]
      : []),
  ];

  const bulletParagraphsByItemId: Record<string, string[]> = {};
  if (hasDescription || !hasExtras) {
    bulletParagraphsByItemId["product-details"] = descriptionBullets;
  }
  if (hasExtras) {
    bulletParagraphsByItemId["extra-details"] = extraDetailLines;
  }

  const categoryLabel = categoryDisplayName(product.category_name);
  const galleryImages = buildProductGalleryImageUrls(product);

  return (
    <div className="bg-background">
      <section className="bg-card pb-12 lg:pb-20">
        <PageContainer>
          {/* Breadcrumb */}
          <nav className="py-4 text-sm text-muted-foreground" aria-label={tDetail("breadcrumbAria")}>
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/" className="transition-colors hover:text-primary">
                  {tDetail("breadcrumbHome")}
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3.5 text-muted-foreground" strokeWidth={2.5} />
              </li>
              <li>
                <Link href="/#products" className="transition-colors hover:text-primary">
                  {tDetail("breadcrumbProducts")}
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3.5 text-muted-foreground" strokeWidth={2.5} />
              </li>
              <li className="max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground">
                {productName}
              </li>
            </ol>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:gap-12 xl:grid-cols-[1fr_460px] xl:gap-16">
            {/* Gallery — full height, no sticky */}
            <div className="min-w-0">
              <ProductGallery images={galleryImages} productName={productName} />
            </div>

            {/* Product info — sticky on desktop */}
            <div className="flex min-w-0 flex-col gap-0 lg:sticky lg:top-24 lg:self-start">
              {/* Category chip */}
              <p className="mb-2 text-xs font-semibold uppercase tracking-normal text-primary">
                {categoryLabel}
              </p>

              <h1 className="text-2xl font-normal leading-snug tracking-tight text-foreground sm:text-3xl">
                {productName}
              </h1>

              {product.brand?.trim() ? (
                <div className="mt-2 flex items-center gap-1.5">
                  <BadgeCheck
                    className="size-4 shrink-0 text-primary"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-foreground">{product.brand.trim()}</span>
                </div>
              ) : null}

              <VariantSelectionProvider variants={product.variants}>
                <ProductDetailSkuRow />

                {/* Price block */}
                <div className="mt-5 rounded-lg bg-card px-4 py-4 sm:px-5">
                  {product.original_price != null ? (
                    <>
                      <p className="price-display-eyebrow">{tDetail("nowLabel")}</p>
                      <p className="price-display-hero mt-1">{formatMoney(unitPrice, activeLocale)}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <div className="flex items-baseline gap-2">
                          <span className="price-display-eyebrow-neutral">{tDetail("wasLabel")}</span>
                          <span className="price-display-compare">
                            {formatMoney(product.original_price, activeLocale)}
                          </span>
                        </div>
                        {discountPercent != null ? (
                          <span className="price-display-discount-pill">
                            {tDetail("priceDiscount", { percent: discountPercent })}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="price-display-hero">{formatMoney(unitPrice, activeLocale)}</p>
                  )}
                </div>

                {/* Divider */}
                <div className="my-5 h-px bg-border/60" />

                {/* Variant picker + buy section */}
                <ProductDetailBuySection
                  productPublicId={product.public_id}
                  productSlug={product.slug}
                  productName={productName}
                  unitPrice={unitPrice}
                  imageUrl={product.image_url}
                  stockStatus={product.stock_status}
                  stockTracking={product.stock_tracking}
                  availableQuantity={product.available_quantity}
                  prepaymentType={product.prepayment_type ?? "none"}
                />
              </VariantSelectionProvider>

              {/* Trust badges */}
              <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-3">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Truck className="size-5 text-primary" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold leading-tight text-muted-foreground">
                    {tDetail("trustFastDelivery")}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <RotateCcw className="size-5 text-primary" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold leading-tight text-muted-foreground">
                    {tDetail("trustEasyReturns")}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <ShieldCheck className="size-5 text-primary" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold leading-tight text-muted-foreground">
                    {tDetail("trustSecurePayment")}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="mt-5" />

              {/* Accordions */}
              <ProductDetailAccordions
                items={accordionItems}
                bulletParagraphsByItemId={bulletParagraphsByItemId}
                defaultOpenId={accordionItems[0]?.id ?? null}
              />
            </div>
          </div>
        </PageContainer>
      </section>

      {product.related_products.length > 0 ? (
        <section className="border-t border-border bg-card py-10 md:py-12">
          <PageContainer>
            <h2 className="mb-8 text-center text-2xl font-normal tracking-tight text-foreground/90 md:mb-10 md:text-3xl">
              {tDetail("relatedProductsTitle")}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {product.related_products.map((related, productIdx) => (
                <StorefrontProductCard
                  key={related.public_id}
                  product={related}
                  locale={activeLocale}
                  aosDelay={(productIdx + 1) * 100}
                />
              ))}
            </div>
          </PageContainer>
        </section>
      ) : null}
    </div>
  );
}
