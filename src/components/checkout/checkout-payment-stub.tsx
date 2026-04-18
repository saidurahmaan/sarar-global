"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { apiFetchJson } from "@/lib/client/api";
import { formatPaperbaseError, stockValidationErrors } from "@/lib/api/paperbase-errors";
import { Link, useRouter, type Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { triggerPurchase } from "@/lib/tracker";
import type { PaperbaseOrderCreateResponse } from "@/types/paperbase";
import type { ProductPrepaymentType } from "@/types/product";

import { writeStoredOrder } from "@/components/orders/order-storage-keys";

import { CheckoutBreadcrumbs } from "./checkout-breadcrumbs";
import {
  CHECKOUT_DRAFT_STORAGE_KEY,
  CHECKOUT_PREPAYMENT_STORAGE_KEY,
} from "./checkout-storage-keys";

function readStoredPrepayment(): ProductPrepaymentType {
  if (typeof window === "undefined") return "none";
  const raw = window.sessionStorage.getItem(CHECKOUT_PREPAYMENT_STORAGE_KEY);
  if (raw === "full" || raw === "delivery_only") return raw;
  return "none";
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

export function CheckoutPaymentStub() {
  const t = useTranslations("checkout");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [resolvedPrepayment, setResolvedPrepayment] = useState<ProductPrepaymentType>("none");
  const requiresPrepayment = resolvedPrepayment !== "none";

  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PaperbaseOrderCreateResponse | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [confirmedPaymentMethod, setConfirmedPaymentMethod] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    const stored = readStoredPrepayment();
    setResolvedPrepayment(stored);
    setPaymentMethod(stored === "none" ? "cod" : "mfs");
  }, []);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      setDraft(JSON.parse(raw) as CheckoutDraft);
    } catch {
      setDraft(null);
    }
  }, []);

  async function handlePlaceOrder() {
    if (!draft) {
      setErrorText("Missing checkout details. Please go back to shipping.");
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
        // The storefront API has no GET /orders/<id>/ — hand the receipt off
        // via sessionStorage so the payment page can drive its UI from it.
        writeStoredOrder(order);
        router.push(`/orders/${order.public_id}/payment`);
        return;
      }
      setConfirmedPaymentMethod(paymentMethod);
      setPlacedOrder(order);
      triggerPurchase({
        order_number: order.order_number,
        total: order.total,
        items: order.items,
        payment_method: paymentMethod,
      });
    } catch (error) {
      const stockErrors = stockValidationErrors(error);
      setErrorText(stockErrors.length ? stockErrors.join(" | ") : formatPaperbaseError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white pb-12 pt-6 md:pb-16 md:pt-8">
      <CheckoutBreadcrumbs step="payment" />

      <div className="mx-auto max-w-xl rounded-lg border border-neutral-200/60 bg-white p-8 shadow-sm md:p-10">
        {placedOrder ? (
          <>
            <h1 className="text-xl font-semibold text-text">{t("orderPlacedTitle")}</h1>
            <dl className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-600">
              <div>
                <dt className="font-medium text-neutral-950">{t("orderNumberLabel")}</dt>
                <dd className="mt-0.5">{placedOrder.order_number}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-950">{t("orderConfirmCustomerName")}</dt>
                <dd className="mt-0.5">{placedOrder.customer_name}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-950">{t("orderConfirmPhone")}</dt>
                <dd className="mt-0.5">{placedOrder.phone}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-950">{t("orderConfirmAddress")}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{placedOrder.shipping_address}</dd>
              </div>
              {confirmedPaymentMethod ? (
                <div>
                  <dt className="font-medium text-neutral-950">{t("orderConfirmPaymentMethod")}</dt>
                  <dd className="mt-0.5">
                    {confirmedPaymentMethod === "cod" ? t("paymentMethodCod") : t("paymentMethodMfs")}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="font-medium text-neutral-950">{t("total")}</dt>
                <dd className="mt-0.5 tabular-nums text-neutral-950">{formatMoney(placedOrder.total, locale)}</dd>
              </div>
            </dl>
            <Link
              href="/"
              className="mt-8 inline-flex rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900"
            >
              {t("continueShoppingAfterOrder")}
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-text">{t("paymentStubHeading")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">{t("paymentStubBody")}</p>

            {requiresPrepayment ? (
              <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">{t("prepaymentRequiredTitle")}</p>
                <p className="mt-1 text-amber-800">
                  {resolvedPrepayment === "full"
                    ? t("prepaymentRequiredFullBody")
                    : t("prepaymentRequiredDeliveryBody")}
                </p>
              </div>
            ) : null}

            <fieldset className="mt-8">
              <legend className="text-base font-semibold text-neutral-950">{t("paymentMethodSection")}</legend>
              <div className="mt-4 grid gap-3">
                {(() => {
                  const options = [
                    {
                      id: "cod" as const,
                      title: t("paymentCodTitle"),
                      description: requiresPrepayment
                        ? t("paymentCodDisabledPrepayment")
                        : t("paymentCodDescription"),
                      disabled: requiresPrepayment,
                      showComingSoon: false,
                    },
                    {
                      id: "mfs" as const,
                      title: t("paymentMfsTitle"),
                      description: requiresPrepayment
                        ? resolvedPrepayment === "full"
                          ? t("paymentMfsPrepayFullDescription")
                          : t("paymentMfsPrepayDeliveryDescription")
                        : t("paymentMfsComingSoonHint"),
                      disabled: !requiresPrepayment,
                      showComingSoon: !requiresPrepayment,
                    },
                  ];
                  return options.map((option) => {
                    const disabled = option.disabled;
                    const selected = !disabled && paymentMethod === option.id;
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 transition-colors",
                          disabled
                            ? "cursor-not-allowed border-neutral-200 bg-neutral-50/90 opacity-90"
                            : cn(
                                "cursor-pointer",
                                selected
                                  ? "border-neutral-200 bg-primary/10"
                                  : "border-neutral-200 bg-white hover:border-neutral-300",
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
                            <span className="text-sm font-medium text-neutral-950">{option.title}</span>
                            {option.showComingSoon ? (
                              <span className="inline-flex shrink-0 rounded-md bg-neutral-200/90 px-2 py-0.5 text-xs font-medium text-neutral-600">
                                {t("paymentMfsComingSoon")}
                              </span>
                            ) : null}
                            {requiresPrepayment && option.id === "mfs" ? (
                              <span className="inline-flex shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                {t("paymentMfsPrepayBadge")}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block text-sm",
                              disabled ? "text-neutral-500" : "text-neutral-600",
                            )}
                          >
                            {option.description}
                          </span>
                        </span>
                      </label>
                    );
                  });
                })()}
              </div>
            </fieldset>

            {errorText ? <p className="mt-4 text-sm text-red-600">{errorText}</p> : null}
            <div className="mt-8 flex w-full flex-nowrap items-stretch gap-2 sm:gap-3">
              <Link
                href="/checkout"
                className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-md border border-neutral-300 px-3 py-2.5 text-center text-sm font-semibold text-neutral-700 sm:flex-none sm:px-5 md:min-h-0 hover:bg-neutral-100"
              >
                {t("backToShipping")}
              </Link>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={loading}
                className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-md bg-primary px-3 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 sm:flex-none sm:px-5 md:min-h-0"
              >
                {loading ? t("placingOrder") : t("placeOrder")}
              </button>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
