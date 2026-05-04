import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrderPaymentView } from "@/components/orders/order-payment-view";
import { PageContainer } from "@/components/layout/page-container";
import { DOCUMENT_METADATA_LOCALE } from "@/lib/document-metadata-locale";
import { routing, type Locale } from "@/i18n/routing";
import { resolveStorefrontDocumentBrand } from "@/lib/storefront";

type PageProps = {
  params: Promise<{ locale: string; publicId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    return {};
  }

  const [t, brand] = await Promise.all([
    getTranslations({ locale: DOCUMENT_METADATA_LOCALE, namespace: "orderPayment" }),
    resolveStorefrontDocumentBrand(),
  ]);

  return {
    title: `${t("metaTitle")} - ${brand}`,
    description: t("metaDescription"),
  };
}

export default async function OrderPaymentPage({ params }: PageProps) {
  const { locale, publicId } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <div className="min-h-screen overflow-x-clip bg-card">
      <PageContainer>
        <OrderPaymentView publicId={publicId} />
      </PageContainer>
    </div>
  );
}
