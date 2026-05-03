import type { Metadata } from "next";
import { Noto_Sans_Bengali, Poppins } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { GlobalPromoPopup } from "@/components/marketing/global-promo-popup";
import { AosInit } from "@/components/common/aos-init";
import { AddToCartDialogHost } from "@/components/common/add-to-cart-dialog";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { StorefrontRuntimeBoot } from "@/components/paperbase/storefront-runtime-boot";
import { routing, type Locale } from "@/i18n/routing";
import { getServerPaperbaseConfig } from "@/lib/server/config";
import { getActivePopup } from "@/lib/server/paperbase";
import { getTrackerScriptSrc } from "@/lib/server/tracking";
import { getStorefrontStorePublic } from "@/lib/storefront";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  preload: false,
});

const notoSansBengali = Noto_Sans_Bengali({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["bengali"],
  variable: "--font-noto-sans-bengali",
  display: "swap",
  preload: false,
});

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }

  const store = await getStorefrontStorePublic();
  const activeLocale: Locale = store.language === "bn" ? "bn" : "en";
  const t = await getTranslations({ locale: activeLocale, namespace: "metadata" });

  return {
    title: store.seo.default_title || store.store_name || t("title"),
    description: store.seo.default_description || t("description"),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [store, popup] = await Promise.all([getStorefrontStorePublic(), getActivePopup()]);
  const activeLocale: Locale = store.language === "bn" ? "bn" : "en";
  setRequestLocale(activeLocale);
  const messages = (await import(`../../../messages/${activeLocale}.json`)).default;
  const { publishableKey } = getServerPaperbaseConfig();
  const trackerSrc = store.tracking_enabled ? getTrackerScriptSrc(store) : "";
  const runtimePublishableKey = store.tracking_enabled ? publishableKey : "";

  return (
    <>
      <StorefrontRuntimeBoot publishableKey={runtimePublishableKey} trackerSrc={trackerSrc} />
      <NextIntlClientProvider locale={activeLocale} messages={messages}>
        <AosInit />
        <div
          lang={activeLocale}
          className={`${poppins.variable} ${notoSansBengali.variable} flex min-h-screen flex-col bg-card ${activeLocale === "bn" ? "font-sans-bn" : "font-sans-en"}`}
        >
          <GlobalPromoPopup popup={popup} />
          <AddToCartDialogHost />
          <Navbar />
          <main className="flex min-h-0 flex-1 flex-col bg-card">{children}</main>
          <Footer />
        </div>
      </NextIntlClientProvider>
    </>
  );
}
