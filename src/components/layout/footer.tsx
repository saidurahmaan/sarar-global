import { MapPin, Mail, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FooterYear } from "@/components/layout/footer-year";
import { PageContainer } from "@/components/layout/page-container";
import { Link } from "@/i18n/routing";
import { getStorefrontStorePublic } from "@/lib/storefront";

function normalizeWhatsappHref(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || /^whatsapp:\/\//i.test(raw)) return raw;
  if (/^wa\.me\//i.test(raw)) return `https://${raw}`;

  const digits = raw.replace(/\D+/g, "");
  if (!digits) return raw;
  const normalized = digits.startsWith("0") ? `88${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M13.5 21v-7h2.4l.4-3H13.5V9.1c0-.9.2-1.6 1.6-1.6h1.4V4.8c-.2 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V11H8.2v3h2.4v7h2.9Z"
      />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm4.5 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm5.2-.9a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
      />
    </svg>
  );
}


function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M20.52 3.45A11.9 11.9 0 0012.06.02C5.47.02.1 5.39.1 11.98c0 2.11.55 4.16 1.6 5.97L0 24l6.22-1.63a11.9 11.9 0 005.84 1.49h.01c6.6 0 11.96-5.37 11.96-11.96 0-3.2-1.24-6.21-3.51-8.45ZM12.07 21.8h-.01a9.8 9.8 0 01-5-1.37l-.36-.21-3.69.97.99-3.6-.24-.37a9.8 9.8 0 01-1.5-5.24c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.02 6.98 2.89a9.8 9.8 0 012.9 6.99c0 5.46-4.44 9.9-9.87 9.9Zm5.44-7.42c-.3-.15-1.78-.88-2.06-.98-.28-.1-.49-.15-.69.15-.2.3-.79.98-.97 1.18-.18.2-.36.23-.66.08-.3-.15-1.27-.47-2.42-1.5a9.1 9.1 0 01-1.68-2.09c-.18-.3-.02-.46.14-.61.14-.14.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.7-1.69-.96-2.31-.25-.6-.5-.52-.69-.53h-.58c-.2 0-.53.08-.8.38-.28.3-1.06 1.04-1.06 2.53 0 1.49 1.08 2.93 1.23 3.13.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.44.25-.71.25-1.32.18-1.44-.08-.12-.28-.2-.58-.35Z"
      />
    </svg>
  );
}

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

  const socialClass =
    "flex size-11 items-center justify-center rounded-md border border-primary-foreground/15 bg-primary-foreground/5 text-primary-foreground transition-colors hover:border-accent/50 hover:bg-primary-foreground/10 hover:opacity-70";

  const socials = [
    {
      id: "facebook",
      label: t("socialFacebook"),
      href: store.social_links.facebook,
      icon: <FacebookIcon className="size-[18px]" />,
    },
    {
      id: "instagram",
      label: t("socialInstagram"),
      href: store.social_links.instagram,
      icon: <InstagramIcon className="size-[18px]" />,
    },
    {
      id: "whatsapp",
      label: t("socialWhatsapp"),
      href: normalizeWhatsappHref(store.social_links.whatsapp),
      icon: <WhatsAppIcon className="size-[18px]" />,
    },
    {
      id: "tiktok",
      label: t("socialTiktok"),
      href: store.social_links.tiktok,
      icon: <TikTokIcon className="size-[18px]" />,
    },
  ].filter((item) => Boolean(item.href?.trim()));

  return (
    <footer className="border-t border-white/10 bg-primary pt-10 pb-8 text-primary-foreground">
      <PageContainer>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div>
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-primary-foreground">
              {t("contact")}
            </h2>
            <ul className="list-none space-y-5 p-0">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary-foreground/75" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-foreground">
                    {t("addressLabel")}
                  </p>
                  <p className="mt-0.5 text-sm font-normal text-primary-foreground/80">
                    {store.address || t("addressLine")}
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-primary-foreground/75" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-foreground">
                    {t("emailLabel")}
                  </p>
                  <a
                    className="mt-0.5 block text-sm text-primary-foreground/80 underline-offset-2 hover:opacity-70 hover:underline"
                    href={`mailto:${store.support_email || t("emailLine")}`}
                  >
                    {store.support_email || t("emailLine")}
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-primary-foreground/75" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-foreground">
                    {t("phoneLabel")}
                  </p>
                  <a
                    className="mt-0.5 block text-sm text-primary-foreground/80 underline-offset-2 hover:opacity-70 hover:underline"
                    href={`tel:${store.phone.replace(/\s/g, "")}`}
                  >
                    {store.phone}
                  </a>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-primary-foreground">
              {t("customer")}
            </h2>
            <ul className="list-none space-y-2.5 p-0">
              <li>
                <Link href="/account" className="text-sm text-primary-foreground/85 underline-offset-2 hover:opacity-70 hover:underline">
                  {t("customerAccount")}
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="text-sm text-primary-foreground/85 underline-offset-2 hover:opacity-70 hover:underline">
                  {t("customerWishlist")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-primary-foreground/85 underline-offset-2 hover:opacity-70 hover:underline">
                  {t("customerBlog")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-primary-foreground">
              <Link href="/information" className="underline-offset-4 hover:opacity-70 hover:underline">
                {t("information")}
              </Link>
            </h2>
            <ul className="list-none space-y-2.5 p-0">
              <li>
                <Link href="/about-us" className="text-sm text-primary-foreground/85 underline-offset-2 hover:opacity-70 hover:underline">
                  {t("infoAbout")}
                </Link>
              </li>
              <li>
                <Link href="/contact-us" className="text-sm text-primary-foreground/85 underline-offset-2 hover:opacity-70 hover:underline">
                  {t("infoContact")}
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-sm text-primary-foreground/85 underline-offset-2 hover:opacity-70 hover:underline">
                  {t("infoPrivacy")}
                </Link>
              </li>
              <li>
                <Link href="/return-refund" className="text-sm text-primary-foreground/85 underline-offset-2 hover:opacity-70 hover:underline">
                  {t("infoReturns")}
                </Link>
              </li>
              <li>
                <Link
                  href="/cancellation-policy"
                  className="text-sm text-primary-foreground/85 underline-offset-2 hover:opacity-70 hover:underline"
                >
                  {t("infoCancellation")}
                </Link>
              </li>
            </ul>
          </div>

          {socials.length > 0 ? (
            <div>
              <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-primary-foreground">
                {t("socialLinks")}
              </h2>
              <div className="flex flex-wrap gap-3">
                {socials.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={socialClass}
                    aria-label={item.label}
                  >
                    {item.icon}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p className="mt-12 text-center text-sm text-primary-foreground/60">
          © <FooterYear />, {store.store_name || common("brand")}
        </p>
      </PageContainer>
    </footer>
  );
}
