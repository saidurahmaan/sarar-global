import type { Metadata } from "next";
import { Home } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { PageContainer } from "@/components/layout/page-container";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { DOCUMENT_METADATA_LOCALE } from "@/lib/document-metadata-locale";
import type { Locale } from "@/i18n/routing";
import { resolveStorefrontDocumentBrand } from "@/lib/storefront";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const [t, brand] = await Promise.all([
    getTranslations({ locale: DOCUMENT_METADATA_LOCALE, namespace: "states" }),
    resolveStorefrontDocumentBrand(),
  ]);
  return {
    title: `${t("notFoundMetaTitle")} - ${brand}`,
    description: t("notFoundMetaDescription"),
  };
}

export default async function NotFoundPage() {
  const locale = (await getLocale()) as Locale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "states" });

  return (
    <div className="flex flex-1 flex-col bg-background">
      <PageContainer>
        <div className="flex min-h-[min(72vh,760px)] flex-col items-center justify-center px-2 py-14 text-center md:py-20">
          <div className="w-full max-w-lg rounded-lg border border-border/70 bg-card px-6 py-10 shadow-sm md:px-10 md:py-12">
            <p
              className="font-sans-en text-[clamp(3.5rem,16vw,7.5rem)] font-extrabold leading-none tracking-tighter text-primary"
              aria-hidden
            >
              404
            </p>
            <h1 className="mt-6 text-pretty text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {t("notFoundTitle")}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("notFoundDescription")}
            </p>

            <div className="mt-10 flex w-full justify-center">
              <Link
                href="/"
                className={cn(
                  buttonVariants({ variant: "primary", size: "md" }),
                  "inline-flex min-h-12 min-w-[10rem] items-center justify-center gap-2",
                )}
              >
                <Home className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                {t("goHome")}
              </Link>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
