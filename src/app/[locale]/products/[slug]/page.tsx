import type { Metadata } from "next";
import { BadgeCheck, ChevronRight, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ProductDetailAccordions } from "@/components/product/product-detail-accordions";
import { ProductDetailBuySection } from "@/components/product/product-detail-buy-section";
import { ProductDetailSkuRow } from "@/components/product/product-detail-sku-row";
import { ProductGallery } from "@/components/product/product-gallery";
import { VariantSelectionProvider } from "@/components/product/product-variant-selection";
import { ProductCard } from "@/components/common/product-card";
import { PageContainer } from "@/components/layout/page-container";
import { Link, routing, type Locale } from "@/i18n/routing";
import { categoryDisplayName } from "@/lib/category-display";
import { formatMoney, parseDecimal } from "@/lib/format";
import { buildProductGalleryImageUrls } from "@/lib/product-gallery";
import { buildProductExtraDetailLines, splitProductDescriptionBullets } from "@/lib/product-extra-fields";
import {
  getStorefrontProductDetail,
  getStorefrontProductSlugs,
  getStorefrontRelatedProducts,
} from "@/lib/products";
import { getStorefrontStorePublic } from "@/lib/storefront";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function logProductPageDependencyFailure(
  dependency: "store-public" | "related-products",
  slug: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[product-detail] failed to load ${dependency} for slug="${slug}": ${message}`);
}

export async function generateStaticParams() {
  const slugs = await getStorefrontProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    return {};
  }

  const [product, storeResult, tMeta] = await Promise.all([
    getStorefrontProductDetail(slug),
    getStorefrontStorePublic().catch((error) => {
      logProductPageDependencyFailure("store-public", slug, error);
      return null;
    }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);
  if (!product) {
    return {};
  }

  const storeName = storeResult?.store_name?.trim() || tMeta("fallbackStoreName");
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

  const [product, relatedProductsResult, storeResult] = await Promise.all([
    getStorefrontProductDetail(slug),
    getStorefrontRelatedProducts(slug).catch((error) => {
      logProductPageDependencyFailure("related-products", slug, error);
      return [];
    }),
    getStorefrontStorePublic().catch((error) => {
      logProductPageDependencyFailure("store-public", slug, error);
      return null;
    }),
  ]);
  if (!product) {
    notFound();
  }
  const relatedProducts = relatedProductsResult;

  const tDetail = await getTranslations("productDetail");
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
    storeResult?.extra_field_schema ?? [],
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
      <section className="bg-white pb-12 lg:pb-20">
        <PageContainer>
          {/* Breadcrumb */}
          <nav className="py-4 text-sm text-neutral-400" aria-label={tDetail("breadcrumbAria")}>
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/" className="transition-colors hover:text-primary">
                  {tDetail("breadcrumbHome")}
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3.5 text-neutral-300" strokeWidth={2.5} />
              </li>
              <li>
                <Link href="/#products" className="transition-colors hover:text-primary">
                  {tDetail("breadcrumbProducts")}
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3.5 text-neutral-300" strokeWidth={2.5} />
              </li>
              <li className="max-w-[min(100%,28rem)] truncate font-thin text-neutral-600">
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

              <h1 className="text-2xl font-thin leading-snug tracking-tight text-text sm:text-3xl">
                {productName}
              </h1>

              {product.brand?.trim() ? (
                <div className="mt-2 flex items-center gap-1.5">
                  <BadgeCheck
                    className="size-4 shrink-0 text-primary"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-text">{product.brand.trim()}</span>
                </div>
              ) : null}

              <VariantSelectionProvider variants={product.variants}>
                <ProductDetailSkuRow />

                {/* Price block */}
                <div className="mt-5 rounded-lg bg-neutral-50 px-4 py-4 sm:px-5">
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
                <div className="my-5 h-px bg-neutral-100" />

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
              <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Truck className="size-5 text-primary" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold leading-tight text-neutral-500">
                    {tDetail("trustFastDelivery")}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <RotateCcw className="size-5 text-primary" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold leading-tight text-neutral-500">
                    {tDetail("trustEasyReturns")}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <ShieldCheck className="size-5 text-primary" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold leading-tight text-neutral-500">
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

      {relatedProducts.length > 0 ? (
        <section className="border-t border-neutral-100 bg-white py-10 md:py-12">
          <PageContainer>
            <h2 className="mb-8 text-center text-2xl font-thin tracking-tight text-text/90 md:mb-10 md:text-3xl">
              {tDetail("relatedProductsTitle")}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {relatedProducts.map((related, productIdx) => (
                <ProductCard key={related.public_id} product={related} aosDelay={(productIdx + 1) * 100} />
              ))}
            </div>
          </PageContainer>
        </section>
      ) : null}
    </div>
  );
}
