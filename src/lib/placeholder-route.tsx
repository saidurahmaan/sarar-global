import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PlaceholderPageShell } from "@/components/layout/placeholder-page-shell";
import { DOCUMENT_METADATA_LOCALE } from "@/lib/document-metadata-locale";
import { routing, type Locale } from "@/i18n/routing";
import { resolveStorefrontDocumentBrand } from "@/lib/storefront";

export type PlaceholderTitleKey =
  | "account"
  | "cart"
  | "wishlist"
  | "information"
  | "aboutUs"
  | "contactUs"
  | "privacyPolicy"
  | "returnRefund"
  | "cancellationPolicy";

export async function placeholderMetadata(locale: string, titleKey: PlaceholderTitleKey): Promise<Metadata> {
  if (!routing.locales.includes(locale as Locale)) {
    return {};
  }

  const [t, brand] = await Promise.all([
    getTranslations({ locale: DOCUMENT_METADATA_LOCALE, namespace: "placeholderPages" }),
    resolveStorefrontDocumentBrand(),
  ]);

  return {
    title: `${t(`titles.${titleKey}`)} - ${brand}`,
    description: t("message"),
  };
}

export async function renderPlaceholderPage(locale: string, titleKey: PlaceholderTitleKey) {
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "placeholderPages" });
  const states = await getTranslations({ locale, namespace: "states" });

  return (
    <PlaceholderPageShell
      title={t(`titles.${titleKey}`)}
      message={t("message")}
      backLabel={states("goHome")}
    />
  );
}
