import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrderPaymentView } from "@/components/orders/order-payment-view";
import { PageContainer } from "@/components/layout/page-container";
import { routing, type Locale } from "@/i18n/routing";

type PageProps = {
  params: Promise<{ locale: string; publicId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: "orderPayment" });

  return {
    title: t("metaTitle"),
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
