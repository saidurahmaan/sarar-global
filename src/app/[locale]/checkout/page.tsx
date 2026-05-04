import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CheckoutShippingView } from "@/components/checkout/checkout-shipping-view";
import { PageContainer } from "@/components/layout/page-container";
import { DOCUMENT_METADATA_LOCALE } from "@/lib/document-metadata-locale";
import { routing, type Locale } from "@/i18n/routing";
import { getStorefrontStorePublic, resolveStorefrontDocumentBrand } from "@/lib/storefront";
import type { CustomerFormVariant } from "@/types/paperbase";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    return {};
  }

  const [t, brand] = await Promise.all([
    getTranslations({ locale: DOCUMENT_METADATA_LOCALE, namespace: "checkout" }),
    resolveStorefrontDocumentBrand(),
  ]);

  return {
    title: `${t("metaTitle")} - ${brand}`,
    description: t("metaDescription"),
  };
}

export default async function CheckoutPage({ params }: PageProps) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const store = await getStorefrontStorePublic();
  const rawVariant = store.checkout_settings?.customer_form_variant;
  const customerFormVariant: CustomerFormVariant =
    rawVariant === "minimal" ? "minimal" : "extended";

  return (
    <div className="min-h-screen overflow-x-clip bg-card">
      <PageContainer>
        <CheckoutShippingView customerFormVariant={customerFormVariant} />
      </PageContainer>
    </div>
  );
}
