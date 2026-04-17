import { MapPin, Mail, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/layout/page-container";
import { Link } from "@/i18n/routing";
import { getStorefrontStorePublic } from "@/lib/storefront";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64v-3.5a6.33 6.33 0 1 0 5.13 6.23V8.73a8.16 8.16 0 0 0 4.77 1.55V6.69h-.79Z"
      />
    </svg>
  );
}

export async function Footer() {
  const [t, common, store] = await Promise.all([
    getTranslations("footer"),
    getTranslations("common"),
    getStorefrontStorePublic(),
  ]);
  const year = new Date().getFullYear();

  const socialClass =
    "flex size-11 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50";

  return (
    <footer className="border-t border-neutral-200 bg-white pt-10 pb-8 text-neutral-900">
      <PageContainer>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div>
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-neutral-900">
              {t("contact")}
            </h2>
            <ul className="list-none space-y-5 p-0">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-neutral-700" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">
                    {t("addressLabel")}
                  </p>
                  <p className="mt-0.5 text-sm font-normal text-neutral-800">{store.address || t("addressLine")}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-neutral-700" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">
                    {t("emailLabel")}
                  </p>
                  <a
                    className="mt-0.5 block text-sm text-neutral-800 underline-offset-2 hover:underline"
                    href={`mailto:${store.support_email || t("emailLine")}`}
                  >
                    {store.support_email || t("emailLine")}
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-neutral-700" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">
                    {t("phoneLabel")}
                  </p>
                  <a
                    className="mt-0.5 block text-sm text-neutral-800 underline-offset-2 hover:underline"
                    href={`tel:${store.phone.replace(/\s/g, "")}`}
                  >
                    {store.phone}
                  </a>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-neutral-900">
              {t("customer")}
            </h2>
            <ul className="list-none space-y-2.5 p-0">
              <li>
                <Link href="/account" className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {t("customerAccount")}
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {t("customerCart")}
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {t("customerWishlist")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {t("customerBlog")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-neutral-900">
              <Link href="/information" className="underline-offset-4 hover:underline">
                {t("information")}
              </Link>
            </h2>
            <ul className="list-none space-y-2.5 p-0">
              <li>
                <Link href="/about-us" className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {t("infoAbout")}
                </Link>
              </li>
              <li>
                <Link href="/contact-us" className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {t("infoContact")}
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {t("infoPrivacy")}
                </Link>
              </li>
              <li>
                <Link href="/return-refund" className="text-sm text-neutral-900 underline-offset-2 hover:underline">
                  {t("infoReturns")}
                </Link>
              </li>
              <li>
                <Link
                  href="/cancellation-policy"
                  className="text-sm text-neutral-900 underline-offset-2 hover:underline"
                >
                  {t("infoCancellation")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-neutral-900">
              {t("socialLinks")}
            </h2>
            <div className="flex flex-wrap gap-3">
              <a
                href={store.social_links.facebook || "https://www.facebook.com/"}
                target="_blank"
                rel="noopener noreferrer"
                className={socialClass}
                aria-label={t("socialFacebook")}
              >
                <span className="text-[17px] font-bold leading-none">f</span>
              </a>
              <a
                href={store.social_links.tiktok || "https://www.tiktok.com/"}
                target="_blank"
                rel="noopener noreferrer"
                className={socialClass}
                aria-label={t("socialTiktok")}
              >
                <TikTokIcon className="size-[18px]" />
              </a>
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-neutral-500">
          © {year} {store.store_name || common("brand")}. {t("copyright")}{" "}
          <span className="text-neutral-400">|</span> {t("developedBy")}{" "}
          <a
            href="https://mushfikurahmaan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-neutral-600 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline"
          >
            {t("developerName")}
          </a>
        </p>
      </PageContainer>
    </footer>
  );
}
