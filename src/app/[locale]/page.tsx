import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { ProductCard } from "@/components/common/product-card";
import { PageContainer } from "@/components/layout/page-container";
import { BannerImageSlider } from "@/components/marketing/banner-image-slider";
import { Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { getStorefrontHomeCategorySections } from "@/lib/products";
import { getStorefrontBanners } from "@/lib/storefront";
import type { PaperbaseBanner } from "@/types/paperbase";

function bannerHasAnyImage(banner: PaperbaseBanner) {
  return Boolean(banner.image_url) || banner.images.some((item) => Boolean(item.image_url));
}

function toBannerSlides(banner: PaperbaseBanner) {
  const fromApiImages = banner.images.filter((item) => Boolean(item.image_url));
  if (fromApiImages.length > 0) {
    return fromApiImages;
  }
  return banner.image_url
    ? [{ public_id: banner.public_id, image_url: banner.image_url, order: 0 }]
    : [];
}

function FullBleedBannerBlock({
  banners,
  headlineFallback,
}: {
  banners: PaperbaseBanner[];
  headlineFallback: string;
}) {
  if (banners.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-6 md:space-y-8">
      {banners.map((banner) => (
        <section key={banner.public_id} className="w-full">
          {bannerHasAnyImage(banner) ? (
            <div className="relative w-full">
              <BannerImageSlider
                title={banner.title}
                headlineFallback={headlineFallback}
                images={toBannerSlides(banner)}
                viewportClassName="h-[230px] sm:h-[320px] md:h-screen"
                showTitleOverlay={Boolean(banner.title?.trim())}
              />
            </div>
          ) : (
            <PageContainer>
              <div className="card mx-auto max-w-4xl px-4 py-6 text-center md:px-6">
                <p className="text-pretty text-base font-semibold leading-snug text-foreground md:text-lg">{banner.title}</p>
              </div>
            </PageContainer>
          )}
        </section>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const [tHome, categorySections, homeTopBanners, homeBottomBanners, locale] = await Promise.all([
    getTranslations("home"),
    getStorefrontHomeCategorySections(),
    getStorefrontBanners("home_top"),
    getStorefrontBanners("home_bottom"),
    getLocale(),
  ]);

  const heroBanner = homeTopBanners.find((banner) => bannerHasAnyImage(banner)) ?? null;
  const hasBottomBanners = homeBottomBanners.length > 0;
  const heroSlides = heroBanner ? toBannerSlides(heroBanner) : [];

  return (
    <div
      className={`bg-card ${heroBanner?.image_url ? "pt-0" : "pt-4 md:pt-6"} ${hasBottomBanners ? "pb-0" : "pb-10 md:pb-14"}`}
    >
      {heroBanner ? (
        <section className="mb-10 w-full md:mb-12">
          {heroSlides.length > 0 ? (
            <BannerImageSlider
              title={heroBanner.title}
              headlineFallback={tHome("headline")}
              images={heroSlides}
              priority
              viewportClassName="h-[230px] sm:h-[320px] md:h-screen"
            />
          ) : (
            <Image
              src={heroBanner.image_url!}
              alt={heroBanner.title?.trim() ? heroBanner.title : tHome("headline")}
              width={2400}
              height={1200}
              priority
              sizes="100vw"
              className="block h-auto w-full max-w-full"
              style={{ width: "100%", height: "auto" }}
            />
          )}
        </section>
      ) : null}

      <PageContainer>
        <section id="products" className="space-y-12 md:space-y-16">
          {categorySections.length === 0 ? (
            <p className="card mx-auto max-w-lg text-center text-sm text-foreground/80">{tHome("emptyProducts")}</p>
          ) : (
            <>
              {categorySections.map((section, sectionIdx) => (
                <div key={section.slug} className="space-y-5 md:space-y-6">
                  <header className="mx-auto max-w-4xl px-1 text-center">
                    <h2 className="text-pretty text-2xl font-light tracking-tight text-foreground md:text-3xl lg:text-4xl">
                      {section.name}
                    </h2>
                    {section.description ? (
                      <p className="mx-auto mt-3 max-w-3xl text-pretty text-base font-normal leading-snug text-foreground/85 md:mt-4 md:text-lg md:leading-relaxed">
                        {section.description}
                      </p>
                    ) : null}
                  </header>
                  <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {section.products.map((product, productIdx) => (
                      <ProductCard
                        key={product.public_id}
                        product={product}
                        locale={locale as Locale}
                        priority={sectionIdx === 0 && productIdx === 0}
                        aosDelay={(productIdx + 1) * 100}
                      />
                    ))}
                  </div>
                  {section.showViewMore ? (
                    <div className="flex justify-center pt-1">
                      <Link
                        href={`/categories/${section.slug}`}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                      >
                        {tHome("viewMore")}
                      </Link>
                    </div>
                  ) : null}

                </div>
              ))}
            </>
          )}
        </section>
      </PageContainer>

      <div className="mt-12 md:mt-16">
        <FullBleedBannerBlock banners={homeBottomBanners} headlineFallback={tHome("headline")} />
      </div>
    </div>
  );
}
