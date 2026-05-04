import { getTranslations } from "next-intl/server";

import { AccountNavLink } from "@/components/common/account-nav-link";
import { CartTrigger } from "@/components/common/cart-drawer-trigger";
import { WishlistNavLink } from "@/components/common/wishlist-nav-link";
import { DesktopCategoryMegaNav } from "@/components/layout/desktop-category-mega-nav";
import { DesktopNavbarScrollVisibility } from "@/components/layout/desktop-navbar-scroll-visibility";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { MobileSearchOverlay } from "@/components/layout/mobile-search-overlay";
import { PageContainer } from "@/components/layout/page-container";
import { StorefrontLiveSearch } from "@/components/layout/storefront-live-search";
import { Link } from "@/i18n/routing";
import { getStorefrontHeaderCategories, getStorefrontNotifications, getStorefrontStorePublic } from "@/lib/storefront";

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

  return (
    <>
      <DesktopNavbarScrollVisibility targetId="storefront-header" />
      <header
        id="storefront-header"
        className="relative sticky top-0 z-40 w-full min-w-0 bg-header text-header-foreground pt-[env(safe-area-inset-top,0px)]"
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
          <div className="flex w-full min-w-0 flex-1 items-center justify-between gap-2 md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              <div className="shrink-0">
                <MobileNavDrawer
                  menuTitle={nav("products")}
                  categories={categories}
                />
              </div>
              <div className="min-w-0 flex-1 self-center overflow-hidden">
                <Link
                  href="/"
                  className="block min-w-0 max-w-full truncate whitespace-nowrap text-start text-lg font-medium uppercase tracking-[0.06em] leading-snug text-header-foreground"
                  aria-label={store.store_name}
                >
                  {store.store_name}
                </Link>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-0">
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

          <div className="hidden w-full min-w-0 flex-1 md:flex md:min-h-[4.25rem] md:items-center md:gap-3 md:py-2 lg:gap-5">
            <div className="flex shrink-0 items-center">
              <Link
                href="/"
                className="inline-flex max-w-full items-center leading-none"
                aria-label={store.store_name}
              >
                <span className="whitespace-nowrap text-xl font-medium uppercase tracking-[0.06em] text-header-foreground md:text-2xl lg:text-[1.75rem]">
                  {store.store_name}
                </span>
              </Link>
            </div>

            <div className="min-w-0 flex-1 basis-0 px-1 md:min-w-[10rem] md:px-3 lg:px-6 xl:px-10">
              <StorefrontLiveSearch
                mode="headerBar"
                placeholder={search("placeholder")}
                submitAriaLabel={nav("openSearch")}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
              <AccountNavLink variant="desktop" />
              <WishlistNavLink variant="desktop" />
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
