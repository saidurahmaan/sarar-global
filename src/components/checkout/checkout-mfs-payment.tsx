"use client";

import Image from "next/image";
import { Check, Copy, Loader2, Phone, ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { formatPaperbaseError } from "@/lib/api/paperbase-errors";
import { submitMfsPayment } from "@/lib/client/checkout-mfs-api";
import { writeCheckoutSuccessMeta } from "@/lib/checkout/order-success-meta";
import { useRouter } from "@/i18n/routing";
import { parseDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { triggerPurchase } from "@/lib/tracker";
import type { PaperbaseOrderReceipt, PaperbaseStorePublic } from "@/types/paperbase";
import type { Locale } from "@/i18n/routing";

import { readStoredOrder, writeStoredOrder } from "@/components/orders/order-storage-keys";

import { CheckoutBreadcrumbs } from "./checkout-breadcrumbs";
import { clearMfsPendingOrderPublicId, readMfsPendingOrderPublicId, writeMfsPendingOrderPublicId } from "./checkout-storage-keys";

import { apiFetchJson } from "@/lib/client/api";

const BKASH_LOGO_SRC = "/assets/payment-provider/BKash-bKash2-Logo.wine.svg";
const NAGAD_LOGO_SRC = "/assets/payment-provider/Nagad-Logo.wine.svg";
const BKASH_PINK = "#D12053";
const BKASH_TERMS_URL = "https://www.bkash.com/en/page/terms-and-conditions";
/** Nagad wordmark red from `Nagad-Logo.wine.svg` */
const NAGAD_RED = "#ed1c24";
const NAGAD_TERMS_URL = "https://nagad.com.bd/en/terms/";

function isValidMfsMsisdn(value: string): boolean {
  const digits = value.replace(/\s/g, "");
  return /^01[3-9]\d{8}$/.test(digits);
}

type MfsProviderDetail = "bkash" | "nagad";

function formatTakaAmount(value: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(parseDecimal(value));
}

export function CheckoutMfsPayment() {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [orderPublicId, setOrderPublicId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaperbaseOrderReceipt | null>(null);
  const [ready, setReady] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [mfsView, setMfsView] = useState<"select" | MfsProviderDetail>("select");
  const [transactionId, setTransactionId] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [storePublic, setStorePublic] = useState<PaperbaseStorePublic | null>(null);
  const [storeInfoLoading, setStoreInfoLoading] = useState(true);
  const [storeNumberCopied, setStoreNumberCopied] = useState(false);
  const copyStoreNumberTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let orderId = params.get("orderId")?.trim() || null;
    if (!orderId) {
      orderId = readMfsPendingOrderPublicId();
    }
    if (!orderId || !orderId.startsWith("ord_")) {
      router.replace("/checkout");
      return;
    }
    writeMfsPendingOrderPublicId(orderId);

    const r = readStoredOrder(orderId);
    if (!r) {
      clearMfsPendingOrderPublicId();
      router.replace("/checkout");
      return;
    }
    if (!r.requires_payment) {
      writeCheckoutSuccessMeta(orderId, { payment_method: "mfs" });
      clearMfsPendingOrderPublicId();
      router.replace(`/success/${orderId}`);
      return;
    }

    const ps = r.payment_status ?? "none";
    if (ps === "submitted" || ps === "verified") {
      writeCheckoutSuccessMeta(orderId, { payment_method: "mfs" });
      clearMfsPendingOrderPublicId();
      router.replace(`/success/${orderId}`);
      return;
    }

    setReceipt(r);
    setOrderPublicId(orderId);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (mfsView !== "bkash" && mfsView !== "nagad") {
      setStoreInfoLoading(true);
      return;
    }
    let cancelled = false;
    setStoreInfoLoading(true);
    setStorePublic(null);
    apiFetchJson<PaperbaseStorePublic>("/store/public")
      .then((s) => {
        if (!cancelled) setStorePublic(s);
      })
      .catch(() => {
        if (!cancelled) setStorePublic(null);
      })
      .finally(() => {
        if (!cancelled) setStoreInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mfsView]);

  useEffect(() => {
    return () => {
      if (copyStoreNumberTimerRef.current) {
        clearTimeout(copyStoreNumberTimerRef.current);
      }
    };
  }, []);

  async function copyStoreNumberToClipboard() {
    const raw = storePublic?.phone?.replace(/\s/g, "") ?? "";
    if (!raw || storeInfoLoading) return;
    try {
      await navigator.clipboard.writeText(raw);
      setStoreNumberCopied(true);
      if (copyStoreNumberTimerRef.current) clearTimeout(copyStoreNumberTimerRef.current);
      copyStoreNumberTimerRef.current = setTimeout(() => {
        setStoreNumberCopied(false);
        copyStoreNumberTimerRef.current = null;
      }, 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleConfirmPayment(provider: MfsProviderDetail) {
    if (payLoading) return;
    if (!orderPublicId) {
      setErrorText(t("mfsMissingOrder"));
      return;
    }

    const tx = transactionId.trim();
    if (!tx) {
      setErrorText(
        provider === "bkash" ? t("bkashErrorTransactionRequired") : t("nagadErrorTransactionRequired"),
      );
      return;
    }
    if (tx.length > 100) {
      setErrorText(provider === "bkash" ? t("bkashErrorTransactionLength") : t("nagadErrorTransactionLength"));
      return;
    }
    const pn = payerPhone.trim();
    if (!isValidMfsMsisdn(pn)) {
      setErrorText(provider === "bkash" ? t("bkashErrorPhone") : t("nagadErrorPhone"));
      return;
    }

    setPayLoading(true);
    setErrorText(null);
    try {
      const next = await submitMfsPayment(orderPublicId, {
        transaction_id: tx,
        payer_number: pn.replace(/\s/g, ""),
      });
      clearMfsPendingOrderPublicId();
      writeStoredOrder(next);
      triggerPurchase({
        order_id: next.public_id,
        value: Number(next.total),
        items: next.items.map((line) => ({
          id: line.product_name,
          quantity: line.quantity,
          item_price: Number(line.unit_price),
        })),
        customer: {
          phone: pn.replace(/\s/g, ""),
        },
      });
      writeCheckoutSuccessMeta(orderPublicId, {
        payment_method: "mfs",
        mfs_provider: provider,
      });
      router.replace(`/success/${orderPublicId}`);
    } catch (error) {
      const msg = formatPaperbaseError(error);
      if (msg.includes("already been submitted")) {
        setErrorText(t("paymentAlreadySubmittedHint"));
      } else {
        setErrorText(msg);
      }
    } finally {
      setPayLoading(false);
    }
  }

  if (!ready || !receipt || !orderPublicId) {
    return (
      <div className="bg-card pb-12 pt-6 md:pb-16 md:pt-8">
        <CheckoutBreadcrumbs step="mfsProvider" />
        <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 shadow-sm md:p-10">
          <div className="h-8 max-w-xs animate-pulse rounded-md bg-muted" />
          <div className="mt-4 h-4 max-w-md animate-pulse rounded-md bg-muted" />
          <div className="mt-8 grid gap-8">
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-24 animate-pulse rounded-lg border border-border bg-background" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-24 animate-pulse rounded-lg border border-border bg-background" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mfsView === "bkash" || mfsView === "nagad") {
    const provider = mfsView;
    const brandColor = provider === "bkash" ? BKASH_PINK : NAGAD_RED;
    const logoSrc = provider === "bkash" ? BKASH_LOGO_SRC : NAGAD_LOGO_SRC;
    const termsUrl = provider === "bkash" ? BKASH_TERMS_URL : NAGAD_TERMS_URL;
    const helplineTel = provider === "bkash" ? "16247" : "16167";

    const gatewayHeading = provider === "bkash" ? t("bkashGatewayHeading") : t("nagadGatewayHeading");
    const storePhonePending = provider === "bkash" ? t("bkashStorePhonePending") : t("nagadStorePhonePending");
    const storePhoneMissing = provider === "bkash" ? t("bkashStorePhoneMissing") : t("nagadStorePhoneMissing");
    const invoiceLabel = provider === "bkash" ? t("bkashInvoiceLabel") : t("nagadInvoiceLabel");
    const sendMoneyTitle = provider === "bkash" ? t("bkashSendMoneyTitle") : t("nagadSendMoneyTitle");
    const sendMoneyBody = provider === "bkash" ? t("bkashSendMoneyBody") : t("nagadSendMoneyBody");
    const copyLabel = provider === "bkash" ? t("bkashCopyStoreNumber") : t("nagadCopyStoreNumber");
    const copiedLabel = provider === "bkash" ? t("bkashCopied") : t("nagadCopied");
    const txLabel = provider === "bkash" ? t("bkashTransactionIdLabel") : t("nagadTransactionIdLabel");
    const txPlaceholder = provider === "bkash" ? t("bkashTransactionIdPlaceholder") : t("nagadTransactionIdPlaceholder");
    const payerLabel = provider === "bkash" ? t("bkashPayerPhoneLabel") : t("nagadPayerPhoneLabel");
    const payerPlaceholder = provider === "bkash" ? t("bkashPayerPhonePlaceholder") : t("nagadPayerPhonePlaceholder");
    const consentBefore = provider === "bkash" ? t("bkashConsentBefore") : t("nagadConsentBefore");
    const confirmWord = provider === "bkash" ? t("bkashConfirmWord") : t("nagadConfirmWord");
    const consentAfter = provider === "bkash" ? t("bkashConsentAfter") : t("nagadConsentAfter");
    const termsLabel = provider === "bkash" ? t("bkashTermsLabel") : t("nagadTermsLabel");
    const closeLabel = provider === "bkash" ? t("bkashClose") : t("nagadClose");
    const confirmLabel = provider === "bkash" ? t("bkashConfirm") : t("nagadConfirm");
    const helplineDisplay = provider === "bkash" ? t("bkashHelpline") : t("nagadHelpline");

    const invoiceId = receipt.order_number || receipt.public_id;
    const instructionPhone = storeInfoLoading
      ? storePhonePending
      : storePublic?.phone?.trim() || storePhoneMissing;

    const sendMoneySectionId = `mfs-${provider}-send-money-heading`;
    const inputTxId = `checkout-${provider}-txid`;
    const inputPayerId = `checkout-${provider}-payer`;

    const txTrim = transactionId.trim();
    const phoneTrim = payerPhone.trim();
    const confirmFormReady =
      txTrim.length > 0 && txTrim.length <= 100 && isValidMfsMsisdn(phoneTrim);

    return (
      <div className="bg-card pb-12 pt-6 md:pb-16 md:pt-8">
        <CheckoutBreadcrumbs step="mfsProvider" />

        <div className="mx-auto w-full max-w-md overflow-hidden rounded-none bg-card shadow-md ring-1 ring-foreground/5 md:rounded-xl">
          <header className="bg-card px-4 pb-3 pt-6 md:px-6">
            <div className="mx-auto flex h-[6.75rem] max-w-sm items-center justify-center">
              <Image
                src={logoSrc}
                alt={gatewayHeading}
                width={400}
                height={120}
                className="max-h-[6rem] w-auto max-w-[min(320px,100%)] object-contain object-center"
              />
            </div>
            <div className="mx-auto mt-4 h-px max-w-sm" style={{ backgroundColor: brandColor }} />
          </header>

          <section className="flex items-start gap-3 border-b border-border bg-card px-4 py-5 md:px-6">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted"
              aria-hidden
            >
              <ShoppingCart className="size-6 text-primary/80" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-[15px] font-medium text-foreground">{tCommon("brand")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {invoiceLabel}: {invoiceId}
              </p>
            </div>
            <div className="shrink-0 pt-0.5 text-right">
              <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatTakaAmount(receipt.total, locale)}
              </p>
            </div>
          </section>

          <section
            className="border-y-2 border-accent/60 bg-accent/15 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35)] md:px-6"
            aria-labelledby={sendMoneySectionId}
          >
            <h2 id={sendMoneySectionId} className="text-base font-bold tracking-tight text-accent-foreground">
              {sendMoneyTitle}
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-accent-foreground/90">{sendMoneyBody}</p>
            <div className="mt-3 flex min-h-[3.25rem] items-center gap-2 rounded-lg border border-accent/45 bg-card px-3 py-2.5 shadow-sm">
              <p className="min-w-0 flex-1 text-xl font-bold tabular-nums leading-tight text-foreground sm:text-2xl">
                {instructionPhone}
              </p>
              <button
                type="button"
                onClick={() => void copyStoreNumberToClipboard()}
                disabled={storeInfoLoading || !storePublic?.phone?.trim()}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent/20 px-2.5 py-2 text-accent-foreground transition-colors",
                  "hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                  "disabled:pointer-events-none disabled:opacity-40",
                )}
                aria-label={storeNumberCopied ? copiedLabel : copyLabel}
              >
                {storeNumberCopied ? (
                  <Check className="size-5" strokeWidth={2.25} aria-hidden />
                ) : (
                  <Copy className="size-5" strokeWidth={2} aria-hidden />
                )}
              </button>
            </div>
          </section>

          <div className="relative overflow-hidden px-0">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  -32deg,
                  transparent,
                  transparent 14px,
                  rgba(255,255,255,0.5) 14px,
                  rgba(255,255,255,0.5) 15px
                ),
                repeating-linear-gradient(
                  58deg,
                  transparent,
                  transparent 18px,
                  rgba(255,255,255,0.22) 18px,
                  rgba(255,255,255,0.22) 19px
                )`,
              }}
              aria-hidden
            />
            <div className="relative space-y-4 px-4 pb-6 pt-6 md:px-6" style={{ backgroundColor: brandColor }}>
              <div>
                <label htmlFor={inputTxId} className="block text-center text-[15px] font-bold text-primary-foreground">
                  {txLabel}
                </label>
                <input
                  id={inputTxId}
                  type="text"
                  autoComplete="off"
                  placeholder={txPlaceholder}
                  value={transactionId}
                  disabled={payLoading}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="mt-3 w-full rounded-lg border-0 bg-card px-4 py-3.5 text-base text-foreground shadow-md outline-none ring-0 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-foreground/40 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor={inputPayerId} className="block text-center text-[15px] font-bold text-primary-foreground">
                  {payerLabel}
                </label>
                <input
                  id={inputPayerId}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder={payerPlaceholder}
                  value={payerPhone}
                  disabled={payLoading}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  className="mt-3 w-full rounded-lg border-0 bg-card px-4 py-3.5 text-base text-foreground shadow-md outline-none ring-0 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-foreground/40 disabled:opacity-60"
                />
              </div>
              <p className="pt-1 text-center text-[13px] leading-snug text-primary-foreground/95">
                {consentBefore} <strong className="font-bold text-primary-foreground">{confirmWord}</strong>
                {consentAfter}{" "}
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-normal underline decoration-primary-foreground/90 underline-offset-2"
                >
                  {termsLabel}
                </a>
              </p>
            </div>
          </div>

          <div
            className="h-1.5 w-full shrink-0 bg-gradient-to-b from-foreground/35 via-foreground/15 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            aria-hidden
          />

          {errorText ? (
            <p className="border-t border-border bg-accent/10 px-4 py-2 text-center text-sm text-accent-foreground md:px-6">
              {errorText}
            </p>
          ) : null}

          {payLoading ? (
            <p className="border-t border-border bg-muted px-4 py-2 text-center text-sm text-muted-foreground md:px-6">
              {t("confirmingPayment")}
            </p>
          ) : null}

          <div className="grid grid-cols-2 border-t border-border bg-primary shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.18)]">
            <button
              type="button"
              disabled={payLoading}
              onClick={() => {
                setMfsView("select");
                setTransactionId("");
                setPayerPhone("");
                setErrorText(null);
                setStoreNumberCopied(false);
                if (copyStoreNumberTimerRef.current) {
                  clearTimeout(copyStoreNumberTimerRef.current);
                  copyStoreNumberTimerRef.current = null;
                }
              }}
              className={cn(
                "cursor-pointer border-r border-primary-foreground/25 py-4 text-center text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors",
                "hover:bg-primary/90",
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {closeLabel}
            </button>
            <button
              type="button"
              disabled={payLoading || !confirmFormReady}
              onClick={() => void handleConfirmPayment(provider)}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 py-4 text-center text-sm font-bold uppercase tracking-wide transition-colors",
                "hover:brightness-110 active:brightness-95",
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
                confirmFormReady && !payLoading
                  ? cn(
                      "text-primary-foreground",
                      "shadow-[inset_0_2px_6px_rgba(0,0,0,0.22),inset_0_-1px_0_rgba(255,255,255,0.18)]",
                      "ring-1 ring-inset ring-primary-foreground/30",
                    )
                  : "bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground",
              )}
              style={
                confirmFormReady && !payLoading
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 42%, rgba(0,0,0,0.2) 100%), linear-gradient(${brandColor}, ${brandColor})`,
                    }
                  : undefined
              }
            >
              {payLoading ? (
                <Loader2 className="size-5 shrink-0 animate-spin text-primary-foreground" strokeWidth={2.25} aria-hidden />
              ) : null}
              {confirmLabel}
            </button>
          </div>

          <footer className="flex items-center justify-center gap-2 bg-card px-4 py-5">
            <span
              className="flex size-9 items-center justify-center rounded-full text-primary-foreground"
              style={{ backgroundColor: brandColor }}
              aria-hidden
            >
              <Phone className="size-4" strokeWidth={2.25} />
            </span>
            <a
              href={`tel:${helplineTel}`}
              className="text-lg font-medium tabular-nums"
              style={{ color: brandColor }}
              aria-label={`${tCommon("callUsNow")} ${helplineDisplay}`}
            >
              {helplineDisplay}
            </a>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card pb-12 pt-6 md:pb-16 md:pt-8">
      <CheckoutBreadcrumbs step="mfsProvider" />

      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 shadow-sm md:p-10">
        <h1 className="text-xl font-semibold text-foreground">{t("mfsProviderTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("mfsProviderDescription")}</p>

        {errorText ? <p className="mt-5 text-sm text-danger">{errorText}</p> : null}

        <div className="mt-8 grid gap-8">
          <div className="space-y-2">
            <label htmlFor="checkout-mfs-bkash" className="block text-sm font-light text-foreground">
              {t("payViaBkash")}
            </label>
            <button
              id="checkout-mfs-bkash"
              type="button"
              className={cn(
                "flex h-[6rem] w-full cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-3 py-2 transition-colors",
                "hover:border-border hover:bg-card",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
              onClick={() => {
                setErrorText(null);
                setMfsView("bkash");
              }}
            >
              <Image
                src={BKASH_LOGO_SRC}
                alt=""
                width={320}
                height={96}
                className="max-h-[4.5rem] w-auto max-w-[min(340px,96%)] object-contain object-center sm:max-h-20"
              />
            </button>
          </div>
          <div className="space-y-2">
            <label htmlFor="checkout-mfs-nagad" className="block text-sm font-light text-foreground">
              {t("payViaNagad")}
            </label>
            <button
              id="checkout-mfs-nagad"
              type="button"
              className={cn(
                "flex h-[6rem] w-full cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-3 py-2 transition-colors",
                "hover:border-border hover:bg-card",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
              onClick={() => {
                setErrorText(null);
                setMfsView("nagad");
              }}
            >
              <Image
                src={NAGAD_LOGO_SRC}
                alt=""
                width={320}
                height={96}
                className="max-h-[4.5rem] w-auto max-w-[min(340px,96%)] object-contain object-center sm:max-h-20"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
