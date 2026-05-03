"use client";

import Lottie from "lottie-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useReducer, useRef, useState } from "react";

import { Link, type Locale } from "@/i18n/routing";
import { PaperbaseApiError, formatPaperbaseError } from "@/lib/api/paperbase-errors";
import { apiFetch } from "@/lib/client/api";
import { formatMoney } from "@/lib/format";
import type { PaperbaseOrderCreateResponse } from "@/types/paperbase";

import type { CheckoutMfsSuccessProvider } from "./checkout-storage-keys";

const CHECKOUT_SUCCESS_LOTTIE_URL =
  "/assets/gopay%20succesfull%20payment/animations/12345.json";

function CheckoutSuccessLottie() {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(CHECKOUT_SUCCESS_LOTTIE_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load animation");
        return res.json() as Promise<object>;
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setAnimationData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!animationData) {
    return <div className="mx-auto size-64 max-w-full animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="mx-auto w-full max-w-xs">
      <Lottie animationData={animationData} loop className="size-full max-h-72" />
    </div>
  );
}

export type CheckoutOrderSuccessPaymentMethod = "cod" | "mfs";

type CheckoutOrderSuccessProps = {
  order: PaperbaseOrderCreateResponse;
  paymentMethod: CheckoutOrderSuccessPaymentMethod;
  /** When payment was MFS, which app the customer paid with (from checkout handoff). */
  mfsProvider?: CheckoutMfsSuccessProvider | null;
};

type InvoiceStatusResponse = {
  ready: boolean;
  url: string;
  message?: string;
};

type InvoiceState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "ready"; url: string }
  | { status: "opening"; url: string }
  | { status: "error"; reason: string };

/**
 * Order-placed success panel (Lottie, summary card, actions) — same layout as COD checkout success.
 */
export function CheckoutOrderSuccess({ order, paymentMethod, mfsProvider }: CheckoutOrderSuccessProps) {
  const t = useTranslations("checkout");
  const locale = useLocale() as Locale;
  const [invoiceState, dispatchInvoiceState] = useReducer(
    (_prev: InvoiceState, next: InvoiceState) => next,
    { status: "idle" } as InvoiceState,
  );
  const invoiceCache = useRef(new Map<string, string>());
  const orderId = order.public_id;

  async function waitForInvoice(signal: AbortSignal): Promise<string> {
    const delays = [1500, 3000, 5000, 8000, 12000, 12000];
    for (const delay of delays) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const res = await fetch(`/api/v1/orders/${orderId}/invoice/status`, { cache: "no-store", signal });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = (await res.json()) as InvoiceStatusResponse;
      if (data.ready === true && data.url) return data.url;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error("Invoice generation timed out");
  }

  useEffect(() => {
    if (invoiceState.status !== "preparing") return;
    const controller = new AbortController();
    waitForInvoice(controller.signal)
      .then((url) => {
        invoiceCache.current.set(orderId, url);
        dispatchInvoiceState({ status: "ready", url });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchInvoiceState({
          status: "error",
          reason: err instanceof Error ? err.message : "Invoice preparation failed",
        });
      });
    return () => controller.abort();
  }, [invoiceState.status, orderId]);

  async function startInvoiceFlow() {
    const cachedUrl = invoiceCache.current.get(orderId);
    if (cachedUrl) {
      dispatchInvoiceState({ status: "ready", url: cachedUrl });
      return;
    }
    dispatchInvoiceState({ status: "preparing" });
    try {
      const response = await apiFetch(`/orders/${orderId}/invoice`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as InvoiceStatusResponse & {
        detail?: string;
      };
      if (response.ok && payload.ready && payload.url) {
        invoiceCache.current.set(orderId, payload.url);
        dispatchInvoiceState({ status: "ready", url: payload.url });
        return;
      }
      if (response.status === 202) return;
      throw new PaperbaseApiError(
        payload.detail || "Invoice endpoint failed",
        response.status,
        payload as Record<string, unknown>,
      );
    } catch (error) {
      dispatchInvoiceState({ status: "error", reason: formatPaperbaseError(error) });
    }
  }

  async function handleInvoiceClick() {
    switch (invoiceState.status) {
      case "idle":
        await startInvoiceFlow();
        break;
      case "ready":
        window.location.assign(`/api/v1/orders/${orderId}/invoice/download`);
        dispatchInvoiceState({ status: "opening", url: invoiceState.url });
        break;
      case "error":
        dispatchInvoiceState({ status: "idle" });
        await startInvoiceFlow();
        break;
      case "preparing":
      case "opening":
        break;
      default:
        break;
    }
  }

  const invoiceBusy = invoiceState.status === "preparing" || invoiceState.status === "opening";
  const invoiceButtonLabel =
    invoiceState.status === "preparing"
      ? t("invoiceButtonGenerating")
      : invoiceState.status === "ready"
        ? t("invoiceButtonSave")
        : invoiceState.status === "opening"
          ? t("invoiceButtonSave")
          : invoiceState.status === "error"
            ? t("invoiceButtonRetryDownload")
            : t("invoiceButtonGet");
  const invoiceMessage =
    invoiceState.status === "preparing"
      ? t("invoiceGeneratingMessage")
      : invoiceState.status === "error"
        ? invoiceState.reason
        : invoiceState.status === "ready" || invoiceState.status === "opening"
          ? t("invoiceDownloaded")
          : null;

  return (
    <div className="flex flex-col items-center text-center">
      <CheckoutSuccessLottie />
      <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground">{t("orderSuccessTitle")}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{t("orderSuccessMessage")}</p>

      <div className="mt-8 w-full max-w-md rounded-lg bg-card px-4 py-5 text-start md:px-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("orderSuccessDeliveryTo")}</p>
        <p className="mt-1 text-sm text-foreground">
          <span className="font-semibold text-foreground">{order.customer_name}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="tabular-nums">{order.phone}</span>
        </p>

        <dl className="mt-5 space-y-3 border-t border-border/60 pt-5 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("orderNumberLabel")}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{order.order_number}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("orderConfirmPaymentMethod")}</dt>
            <dd className="font-medium text-foreground">
              {paymentMethod === "cod"
                ? t("paymentMethodCod")
                : mfsProvider === "bkash"
                  ? t("paymentMethodBkash")
                  : mfsProvider === "nagad"
                    ? t("paymentMethodNagad")
                    : t("paymentMethodMfs")}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("total")}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{formatMoney(order.total, locale)}</dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("orderSummary")}</p>
          <ul className="mt-2 space-y-2 text-sm text-foreground">
            {order.items.slice(0, 3).map((item, index) => (
              <li key={`${item.product_name}-${index}`} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {item.product_name}
                  <span className="text-muted-foreground"> ×{item.quantity}</span>
                </span>
              </li>
            ))}
          </ul>
          {order.items.length > 3 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("orderSuccessMoreItems", { count: order.items.length - 3 })}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="mt-8 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-card disabled:opacity-60"
        onClick={() => void handleInvoiceClick()}
        disabled={invoiceBusy}
      >
        {invoiceButtonLabel}
      </button>
      {invoiceMessage ? (
        <p className="mt-2 max-w-xs text-center text-xs text-muted-foreground">{invoiceMessage}</p>
      ) : null}

      <div className="mt-4 flex w-full max-w-xs justify-center">
        <Link
          href="/"
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("continueShoppingAfterOrder")}
        </Link>
      </div>
    </div>
  );
}
