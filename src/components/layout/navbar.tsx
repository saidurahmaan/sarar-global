import { getTranslations } from "next-intl/server";

import { AccountNavLink } from "@/components/common/account-nav-link";
import { CartTrigger } from "@/components/common/cart-drawer-trigger";
import { Link } from "@/i18n/routing";
import { DesktopSearchOverlay } from "@/components/layout/desktop-search-overlay";
import { DesktopCategoryMegaNav } from "@/components/layout/desktop-category-mega-nav";
import { DesktopNavbarScrollVisibility } from "@/components/layout/desktop-navbar-scroll-visibility";
import { MobileSearchOverlay } from "@/components/layout/mobile-search-overlay";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { PageContainer } from "@/components/layout/page-container";
import { getStorefrontHeaderCategories, getStorefrontNotifications, getStorefrontStorePublic } from "@/lib/storefront";

/** First word on top, remainder below (e.g. "Modern Store" -> Modern / Store). */
function splitBrandName(name: string): { top: string; bottom: string } {
  const trimmed = name.trim();
  const m = trimmed.match(/^(\S+)\s+(.+)$/);
  if (!m) {
    return { top: trimmed, bottom: "" };
  }
  return { top: m[1], bottom: m[2].trim() };
}

export async function Navbar() {
  const [common, nav, search, product, store, categories, notifications] = await Promise.all([
    getTranslations("common"),
    getTranslations("nav"),
    getTranslations("search"),
    getTranslations("product"),
    getStorefrontStorePublic(),
    getStorefrontHeaderCategories(),
    getStorefrontNotifications(),
  ]);
  const topNotice = notifications[0]?.cta_text?.trim() ?? "";
  const { top: brandTop, bottom: brandBottom } = splitBrandName(store.store_name);

  return (
    <>
      <DesktopNavbarScrollVisibility targetId="storefront-header" />
      <header
        id="storefront-header"
        className="relative sticky top-0 z-40 w-full min-w-0 bg-header text-header-foreground pt-[env(safe-area-inset-top,0px)] ps-[env(safe-area-inset-left,0px)] pe-[env(safe-area-inset-right,0px)]"
      >
      {topNotice ? (
        <div className="bg-accent text-accent-foreground">
          <PageContainer>
            <p className="flex items-center justify-center gap-2 py-1.5 text-center text-[14px] font-medium leading-[1.12] tracking-normal text-accent-foreground md:py-2 md:text-[15px]">
              {topNotice}
            </p>
          </PageContainer>
        </div>
      ) : null}

      <PageContainer>
        <div className="flex min-h-14 items-center gap-3 py-1.5 md:min-h-16 md:gap-4 md:py-2">
          <div className="grid w-full min-w-0 flex-1 grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 md:hidden">
            <MobileNavDrawer
              menuTitle={nav("products")}
              categories={categories}
            />
            <div className="flex min-w-0 items-center justify-center">
              <Link
                href="/"
                className="inline-flex min-w-0 items-center justify-center rounded-md text-header-foreground"
                aria-label={store.store_name}
              >
                <span className="block max-w-full truncate whitespace-nowrap text-base font-medium uppercase tracking-[0.06em] text-header-foreground leading-tight">
                  {store.store_name}
                </span>
              </Link>
            </div>
            <div className="flex items-center justify-end gap-1">
              <MobileSearchOverlay
                compact
                placeholder={search("placeholder")}
                openSearchAriaLabel={nav("openSearch")}
                submitAriaLabel={nav("openSearch")}
                closeLabel={common("close")}
              />
              <CartTrigger variant="mobile" />
            </div>
          </div>

          <div className="hidden w-full min-w-0 flex-1 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
            <DesktopSearchOverlay
              placeholder={search("placeholder")}
              openSearchAriaLabel={nav("openSearch")}
              submitAriaLabel={nav("openSearch")}
              closeLabel={common("close")}
            />

            <Link
              href="/"
              className="inline-flex items-center justify-center leading-tight"
              aria-label={store.store_name}
            >
              <span className="block max-w-full truncate whitespace-nowrap text-xl font-medium uppercase tracking-[0.08em] leading-tight text-header-foreground">
                {store.store_name}
              </span>
            </Link>

            <div className="flex items-center justify-end gap-2 md:gap-3">
              <AccountNavLink variant="desktop" />
              <CartTrigger variant="desktop" />
            </div>
          </div>
        </div>
      </PageContainer>
      <div className="h-px w-full bg-header-foreground/15 md:hidden" />

      <div className="hidden h-px w-full bg-header-foreground/15 md:block" />

      <div className="hidden md:block">
        <DesktopCategoryMegaNav
          ariaLabel={nav("products")}
          browseEyebrow={nav("products")}
          newBadgeLabel={product("newBadge")}
          categories={categories}
        />
      </div>
      </header>
    </>
  );
}
