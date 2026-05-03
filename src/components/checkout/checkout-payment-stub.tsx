"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { apiFetchJson } from "@/lib/client/api";
import { formatPaperbaseError, stockValidationErrors } from "@/lib/api/paperbase-errors";
import { createMfsOrder } from "@/lib/client/checkout-mfs-api";
import { writeCheckoutSuccessMeta } from "@/lib/checkout/order-success-meta";
import { Link, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { triggerPurchase } from "@/lib/tracker";
import type { PaperbaseOrderCreateResponse } from "@/types/paperbase";
import type { ProductPrepaymentType } from "@/types/product";

import { readStoredOrder, writeStoredOrder } from "@/components/orders/order-storage-keys";

import { CheckoutBreadcrumbs } from "./checkout-breadcrumbs";
import {
  CHECKOUT_DRAFT_STORAGE_KEY,
  CHECKOUT_PREPAYMENT_STORAGE_KEY,
  LEGACY_CHECKOUT_SUCCESS_HANDOFF_KEY,
  readMfsPendingOrderPublicId,
  writeMfsPendingOrderPublicId,
} from "./checkout-storage-keys";

function readStoredPrepayment(): ProductPrepaymentType {
  if (typeof window === "undefined") return "none";
  const raw = window.sessionStorage.getItem(CHECKOUT_PREPAYMENT_STORAGE_KEY);
  if (raw === "full" || raw === "delivery_only") return raw;
  return "none";
}

type LegacySuccessHandoff = {
  order: PaperbaseOrderCreateResponse;
  payment_method: "cod" | "mfs";
  mfs_provider?: "bkash" | "nagad";
};

let legacySuccessHandoffMemory: LegacySuccessHandoff | null = null;

/** Read one-shot legacy handoff from sessionStorage (Strict Mode–safe). */
function peekLegacySuccessHandoff(): LegacySuccessHandoff | null {
  if (typeof window === "undefined") return legacySuccessHandoffMemory;
  const raw = window.sessionStorage.getItem(LEGACY_CHECKOUT_SUCCESS_HANDOFF_KEY);
  if (raw) {
    try {
      legacySuccessHandoffMemory = JSON.parse(raw) as LegacySuccessHandoff;
      window.sessionStorage.removeItem(LEGACY_CHECKOUT_SUCCESS_HANDOFF_KEY);
    } catch {
      window.sessionStorage.removeItem(LEGACY_CHECKOUT_SUCCESS_HANDOFF_KEY);
      legacySuccessHandoffMemory = null;
    }
  }
  return legacySuccessHandoffMemory;
}

function clearLegacySuccessHandoffMemory(): void {
  legacySuccessHandoffMemory = null;
}

type CheckoutDraft = {
  shipping_zone_public_id: string;
  shipping_method_public_id?: string;
  shipping_name: string;
  phone: string;
  email?: string;
  shipping_address: string;
  district?: string;
  products: Array<{
    product_public_id: string;
    quantity: number;
    variant_public_id?: string;
  }>;
};

type PaymentMethod = "cod" | "mfs";
type PaymentOption = {
  id: PaymentMethod;
  title: string;
  description: string;
  disabled: boolean;
  showComingSoon: boolean;
};

export function CheckoutPaymentStub() {
  const t = useTranslations("checkout");
  const router = useRouter();

  const [resolvedPrepayment, setResolvedPrepayment] = useState<ProductPrepaymentType>("none");
  const requiresPrepayment = resolvedPrepayment !== "none";

  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");

  useEffect(() => {
    const stored = readStoredPrepayment();
    setResolvedPrepayment(stored);
    setPaymentMethod(stored === "none" ? "cod" : "mfs");
  }, []);

  useEffect(() => {
    const handoff = peekLegacySuccessHandoff();
    if (handoff?.order?.public_id?.startsWith("ord_")) {
      writeStoredOrder(handoff.order);
      writeCheckoutSuccessMeta(handoff.order.public_id, {
        payment_method: handoff.payment_method,
        ...(handoff.mfs_provider === "bkash" || handoff.mfs_provider === "nagad"
          ? { mfs_provider: handoff.mfs_provider }
          : {}),
      });
      router.replace(`/success/${handoff.order.public_id}`);
      clearLegacySuccessHandoffMemory();
      return;
    }

    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      setDraft(JSON.parse(raw) as CheckoutDraft);
    } catch {
      setDraft(null);
    }
  }, [router]);

  async function handlePlaceOrder() {
    if (!draft) {
      setErrorText(t("errorMissingCheckoutDetails"));
      return;
    }
    setLoading(true);
    setErrorText(null);
    try {
      const order = await apiFetchJson<PaperbaseOrderCreateResponse>("/checkout/order", {
        method: "POST",
        body: JSON.stringify({ ...draft, payment_method: paymentMethod }),
      });
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(CHECKOUT_PREPAYMENT_STORAGE_KEY);
      if (order.requires_payment === true) {
        writeStoredOrder(order);
        router.push(`/orders/${order.public_id}/payment`);
        return;
      }
      writeStoredOrder(order);
      writeCheckoutSuccessMeta(order.public_id, { payment_method: paymentMethod });
      triggerPurchase({
        order_id: order.public_id,
        value: Number(order.total),
        items: order.items.map((line) => ({
          id: line.product_name,
          quantity: line.quantity,
          item_price: Number(line.unit_price),
        })),
        customer: {
          email: draft.email || "",
          phone: draft.phone || "",
          first_name: draft.shipping_name.split(" ")[0] || "",
          last_name: draft.shipping_name.split(" ").slice(1).join(" ") || "",
          city: draft.district || "",
        },
      });
      router.replace(`/success/${order.public_id}`);
    } catch (error) {
      const stockErrors = stockValidationErrors(error);
      setErrorText(stockErrors.length ? stockErrors.join(" | ") : formatPaperbaseError(error));
    } finally {
      setLoading(false);
    }
  }

  const prepayWithMfs = requiresPrepayment && paymentMethod === "mfs";

  async function handleContinueToMfsPayment() {
    if (loading) return;
    if (!draft) {
      setErrorText(t("errorMissingCheckoutDetails"));
      return;
    }
    setLoading(true);
    setErrorText(null);
    try {
      const pendingId = readMfsPendingOrderPublicId();
      if (pendingId) {
        const existing = readStoredOrder(pendingId);
        const ps = existing?.payment_status ?? "none";
        if (
          existing &&
          existing.requires_payment === true &&
          ps === "none" &&
          existing.status === "payment_pending"
        ) {
          router.push(`/checkout/payment/mfs?orderId=${encodeURIComponent(pendingId)}`);
          return;
        }
      }

      const order = await createMfsOrder(draft);
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(CHECKOUT_PREPAYMENT_STORAGE_KEY);

      if (order.requires_payment !== true) {
        writeStoredOrder(order);
        writeCheckoutSuccessMeta(order.public_id, { payment_method: "mfs" });
        triggerPurchase({
          order_id: order.public_id,
          value: Number(order.total),
          items: order.items.map((line) => ({
            id: line.product_name,
            quantity: line.quantity,
            item_price: Number(line.unit_price),
          })),
          customer: {
            email: draft.email || "",
            phone: draft.phone || "",
            first_name: draft.shipping_name.split(" ")[0] || "",
            last_name: draft.shipping_name.split(" ").slice(1).join(" ") || "",
            city: draft.district || "",
          },
        });
        router.replace(`/success/${order.public_id}`);
        return;
      }

      writeStoredOrder(order);
      writeMfsPendingOrderPublicId(order.public_id);
      router.push(`/checkout/payment/mfs?orderId=${encodeURIComponent(order.public_id)}`);
    } catch (error) {
      const stockErrors = stockValidationErrors(error);
      setErrorText(stockErrors.length ? stockErrors.join(" | ") : formatPaperbaseError(error));
    } finally {
      setLoading(false);
    }
  }

  function handlePrimaryClick() {
    if (prepayWithMfs) {
      void handleContinueToMfsPayment();
      return;
    }
    void handlePlaceOrder();
  }

  return (
    <div className="bg-card pb-12 pt-6 md:pb-16 md:pt-8">
      <CheckoutBreadcrumbs step="payment" />

      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 shadow-sm md:p-10">
        <h1 className="text-xl font-semibold text-foreground">{t("paymentStubHeading")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("paymentStubBody")}</p>

        {requiresPrepayment ? (
          <div className="mt-5 rounded-md border border-accent/40 bg-accent/15 px-4 py-3 text-sm text-accent-foreground">
            <p className="font-semibold">{t("prepaymentRequiredTitle")}</p>
            <p className="mt-1 text-accent-foreground/80">
              {resolvedPrepayment === "full"
                ? t("prepaymentRequiredFullBody")
                : t("prepaymentRequiredDeliveryBody")}
            </p>
          </div>
        ) : null}

        <fieldset className="mt-8">
          <legend className="text-base font-semibold text-foreground">{t("paymentMethodSection")}</legend>
          <div className="mt-4 grid gap-3">
            {(() => {
              const options: PaymentOption[] = [
                {
                  id: "cod",
                  title: t("paymentCodTitle"),
                  description: requiresPrepayment ? t("paymentCodDisabledPrepayment") : t("paymentCodDescription"),
                  disabled: requiresPrepayment,
                  showComingSoon: false,
                },
              ];
              if (requiresPrepayment) {
                options.push({
                  id: "mfs",
                  title: t("paymentMfsTitle"),
                  description:
                    resolvedPrepayment === "full"
                      ? t("paymentMfsPrepayFullDescription")
                      : t("paymentMfsPrepayDeliveryDescription"),
                  disabled: false,
                  showComingSoon: false,
                });
              }
              return options.map((option) => {
                const disabled = option.disabled;
                const selected = !disabled && paymentMethod === option.id;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 transition-colors",
                      disabled
                        ? "cursor-not-allowed border-border bg-background/90 opacity-90"
                        : cn(
                            "cursor-pointer",
                            selected
                              ? "border-border bg-primary/10"
                              : "border-border bg-card hover:border-border",
                          ),
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.id}
                      disabled={disabled}
                      checked={selected}
                      onChange={() => {
                        if (!disabled) {
                          setPaymentMethod(option.id);
                        }
                      }}
                      className={cn(
                        "mt-0.5 size-4 shrink-0 accent-primary",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                    />
                    <span className="min-w-0 text-start">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-foreground">{option.title}</span>
                        {option.showComingSoon ? (
                          <span className="inline-flex shrink-0 rounded-md bg-muted/90 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {t("paymentMfsComingSoon")}
                          </span>
                        ) : null}
                        {requiresPrepayment && option.id === "mfs" ? (
                          <span className="inline-flex shrink-0 rounded-md bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                            {t("paymentMfsPrepayBadge")}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        </fieldset>

        {errorText ? <p className="mt-4 text-sm text-danger">{errorText}</p> : null}

        <div className="mt-8 flex w-full flex-nowrap items-stretch gap-2 sm:gap-3">
          <Link
            href="/checkout"
            className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 py-2.5 text-center text-sm font-semibold text-foreground sm:flex-none sm:px-5 md:min-h-0 hover:bg-muted"
          >
            {t("backToShipping")}
          </Link>
          <button
            type="button"
            onClick={handlePrimaryClick}
            disabled={loading}
            className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:flex-none sm:px-5 md:min-h-0"
          >
            {loading ? (
              <>
                <Loader2 className="size-5 shrink-0 animate-spin" strokeWidth={2.25} aria-hidden />
                <span>{prepayWithMfs ? t("continuingToPayment") : t("placingOrder")}</span>
              </>
            ) : prepayWithMfs ? (
              t("continueToPaymentPrepay")
            ) : (
              t("placeOrder")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
