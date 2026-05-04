import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CartPageClient } from "@/components/common/cart-page-client";
import { PageContainer } from "@/components/layout/page-container";
import { DOCUMENT_METADATA_LOCALE } from "@/lib/document-metadata-locale";
import { routing, type Locale } from "@/i18n/routing";
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
    getTranslations({ locale: DOCUMENT_METADATA_LOCALE, namespace: "cart" }),
    resolveStorefrontDocumentBrand(),
  ]);

  return {
    title: `${t("title")} - ${brand}`,
  };
}

export default async function CartPage({ params }: PageProps) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-card py-10 md:py-14">
      <PageContainer>
        <CartPageClient />
      </PageContainer>
    </div>
  );
}

