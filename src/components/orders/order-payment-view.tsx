"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link, type Locale } from "@/i18n/routing";
import { PaperbaseApiError, formatPaperbaseError } from "@/lib/api/paperbase-errors";
import { apiFetchJson } from "@/lib/client/api";
import { formatMoney } from "@/lib/format";
import { triggerPurchase } from "@/lib/tracker";
import { cn } from "@/lib/utils";
import type {
  PaperbaseOrderReceipt,
  PaperbasePrepaymentType,
  PaperbaseStorePublic,
} from "@/types/paperbase";

import {
  PURCHASE_FIRED_KEY_PREFIX,
  readStoredOrder,
  writeStoredOrder,
} from "./order-storage-keys";

type OrderPaymentViewProps = {
  publicId: string;
};

type FieldErrors = {
  transaction_id?: string;
  payer_number?: string;
};

const PHONE_SHAPE = /^[0-9+\-\s]{6,32}$/;

function amountForReceipt(order: PaperbaseOrderReceipt): {
  amount: string;
  kind: PaperbasePrepaymentType;
} {
  const kind = (order.prepayment_type ?? "none") as PaperbasePrepaymentType;
  if (kind === "delivery_only") {
    return { amount: order.shipping_cost, kind };
  }
  return { amount: order.total, kind };
}

function extractFieldErrors(payload: unknown): FieldErrors {
  if (!payload || typeof payload !== "object") return {};
  const result: FieldErrors = {};
  const record = payload as Record<string, unknown>;
  const get = (key: string): string | undefined => {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) return String(value[0]);
    if (typeof value === "string") return value;
    return undefined;
  };
  const tx = get("transaction_id");
  const pn = get("payer_number");
  if (tx) result.transaction_id = tx;
  if (pn) result.payer_number = pn;
  return result;
}

function isAlreadySubmitted(error: unknown): boolean {
  if (!(error instanceof PaperbaseApiError) || error.status !== 400) return false;
  const payload = error.payload;
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = String((payload as { detail: unknown }).detail ?? "").toLowerCase();
    return (
      detail.includes("already submitted") ||
      detail.includes("already been submitted") ||
      detail.includes("already verified")
    );
  }
  return false;
}

export function OrderPaymentView({ publicId }: OrderPaymentViewProps) {
  const t = useTranslations("orderPayment");
  const tCheckout = useTranslations("checkout");
  const locale = useLocale() as Locale;

  // Read the cached receipt synchronously on the first render so refresh keeps
  // the same view. Falls back to `null` for direct URL visits / expired session.
  const [order, setOrder] = useState<PaperbaseOrderReceipt | null>(() =>
    readStoredOrder(publicId),
  );
  const [store, setStore] = useState<PaperbaseStorePublic | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [transactionId, setTransactionId] = useState("");
  const [payerNumber, setPayerNumber] = useState("");
  const [resubmitting, setResubmitting] = useState(false);

  const purchaseFiredRef = useRef(false);

  // Public store info (phone for payment instructions) — non-critical.
  useEffect(() => {
    let cancelled = false;
    apiFetchJson<PaperbaseStorePublic>("/store/public")
      .then((s) => {
        if (!cancelled) setStore(s);
      })
      .catch(() => {
        // Fall back to static i18n copy.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!order) return;
    if (order.status !== "confirmed") return;
    if (purchaseFiredRef.current) return;
    const storageKey = `${PURCHASE_FIRED_KEY_PREFIX}${order.public_id}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) {
        purchaseFiredRef.current = true;
        return;
      }
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage unavailable — fire anyway, best effort.
    }
    purchaseFiredRef.current = true;
    triggerPurchase({
      order_number: order.order_number,
      total: order.total,
      items: order.items,
      payment_method: "prepayment",
    });
  }, [order]);

  function applyOrderUpdate(next: PaperbaseOrderReceipt) {
    setOrder(next);
    writeStoredOrder(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const tx = transactionId.trim();
    const pn = payerNumber.trim();
    const localErrors: FieldErrors = {};
    if (!tx) localErrors.transaction_id = t("errorTransactionRequired");
    else if (tx.length > 100) localErrors.transaction_id = t("errorTransactionLength");
    if (!pn) localErrors.payer_number = t("errorPayerRequired");
    else if (pn.length > 32) localErrors.payer_number = t("errorPayerLength");
    else if (!PHONE_SHAPE.test(pn)) localErrors.payer_number = t("errorPayerShape");
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors);
      setSubmitError(null);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    try {
      const updated = await apiFetchJson<PaperbaseOrderReceipt>(
        `/orders/${publicId}/payment`,
        {
          method: "POST",
          body: JSON.stringify({ transaction_id: tx, payer_number: pn }),
        },
      );
      applyOrderUpdate(updated);
      setResubmitting(false);
      setTransactionId("");
      setPayerNumber("");
    } catch (error) {
      if (error instanceof PaperbaseApiError) {
        if (error.status === 404) {
          setSubmitError(t("orderNotFound"));
        } else if (error.status === 400) {
          const remote = extractFieldErrors(error.payload);
          if (Object.keys(remote).length > 0) {
            setFieldErrors(remote);
          } else if (isAlreadySubmitted(error)) {
            // Backend says this order already has a pending / verified
            // submission. Surface a friendly message and switch out of the
            // form view — no GET endpoint exists to re-sync the latest state.
            setResubmitting(false);
            setSubmitError(t("alreadySubmittedMessage"));
          } else {
            setSubmitError(formatPaperbaseError(error));
          }
        } else {
          setSubmitError(formatPaperbaseError(error));
        }
      } else {
        setSubmitError(formatPaperbaseError(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // No cached receipt → direct URL visit or expired session. We can't show the
  // amount or order summary, but we can still offer a minimal submission form
  // and let the backend be the source of truth.
  if (!order) {
    return (
      <div className="bg-white pb-12 pt-6 md:pb-16 md:pt-8">
        <div className="mx-auto max-w-xl rounded-lg border border-neutral-200/60 bg-white p-8 shadow-sm md:p-10">
          <h1 className="text-xl font-semibold text-text">{t("lostSessionTitle")}</h1>
          <p className="mt-3 text-sm text-neutral-600">{t("lostSessionBody")}</p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900"
          >
            {tCheckout("continueShoppingAfterOrder")}
          </Link>
        </div>
      </div>
    );
  }

  const { amount, kind } = amountForReceipt(order);
  const paymentStatus = order.payment_status ?? "none";
  const status = order.status;

  // Defensive: if this order doesn't require payment, fall back to a simple receipt.
  const requiresPayment = order.requires_payment === true || kind !== "none";

  if (!requiresPayment) {
    return (
      <div className="bg-white pb-12 pt-6 md:pb-16 md:pt-8">
        <div className="mx-auto max-w-xl rounded-lg border border-neutral-200/60 bg-white p-8 shadow-sm md:p-10">
          <h1 className="text-xl font-semibold text-text">{tCheckout("orderPlacedTitle")}</h1>
          <OrderReceiptList order={order} locale={locale} />
          <Link
            href="/"
            className="mt-8 inline-flex rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900"
          >
            {tCheckout("continueShoppingAfterOrder")}
          </Link>
        </div>
      </div>
    );
  }

  const showForm =
    (status === "payment_pending" && (paymentStatus === "none" || paymentStatus === "failed")) ||
    resubmitting;
  const showAwaiting =
    status === "payment_pending" && paymentStatus === "submitted" && !resubmitting;
  const showConfirmed = status === "confirmed";
  const showRejected = status === "cancelled" && paymentStatus === "failed";

  return (
    <div className="bg-white pb-12 pt-6 md:pb-16 md:pt-8">
      <div className="mx-auto max-w-xl rounded-lg border border-neutral-200/60 bg-white p-8 shadow-sm md:p-10">
        {showConfirmed ? (
          <ConfirmedView order={order} locale={locale} />
        ) : showRejected ? (
          <RejectedView order={order} />
        ) : showAwaiting ? (
          <AwaitingView
            order={order}
            locale={locale}
            amount={amount}
            kind={kind}
            errorText={submitError}
          />
        ) : showForm ? (
          <FormView
            order={order}
            locale={locale}
            amount={amount}
            kind={kind}
            store={store}
            transactionId={transactionId}
            payerNumber={payerNumber}
            onTransactionIdChange={setTransactionId}
            onPayerNumberChange={setPayerNumber}
            onSubmit={handleSubmit}
            submitting={submitting}
            fieldErrors={fieldErrors}
            submitError={submitError}
            isResubmitting={resubmitting && paymentStatus === "failed"}
          />
        ) : (
          <div>
            <h1 className="text-xl font-semibold text-text">{t("unexpectedTitle")}</h1>
            <p className="mt-3 text-sm text-neutral-600">{t("unexpectedBody")}</p>
            <Link
              href="/"
              className="mt-8 inline-flex rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900"
            >
              {tCheckout("continueShoppingAfterOrder")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderReceiptList({
  order,
  locale,
}: {
  order: PaperbaseOrderReceipt;
  locale: Locale;
}) {
  const tCheckout = useTranslations("checkout");
  const tPrepay = useTranslations("prepayment");
  const prepaymentKind = (order.prepayment_type ?? "none") as PaperbasePrepaymentType;
  const prepaymentNotice =
    prepaymentKind === "full"
      ? tPrepay("badgeFull")
      : prepaymentKind === "delivery_only"
        ? tPrepay("badgeDelivery")
        : null;

  return (
    <dl className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-600">
      <div>
        <dt className="font-medium text-neutral-950">{tCheckout("orderNumberLabel")}</dt>
        <dd className="mt-0.5">{order.order_number}</dd>
      </div>
      <div>
        <dt className="font-medium text-neutral-950">{tCheckout("orderConfirmCustomerName")}</dt>
        <dd className="mt-0.5">{order.customer_name}</dd>
      </div>
      <div>
        <dt className="font-medium text-neutral-950">{tCheckout("orderConfirmPhone")}</dt>
        <dd className="mt-0.5">{order.phone}</dd>
      </div>
      <div>
        <dt className="font-medium text-neutral-950">{tCheckout("orderConfirmAddress")}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap">{order.shipping_address}</dd>
      </div>
      {prepaymentNotice ? (
        <div>
          <dt className="font-medium text-neutral-950">{tCheckout("orderPrepaymentNoticeLabel")}</dt>
          <dd className="mt-0.5 text-neutral-700">{prepaymentNotice}</dd>
        </div>
      ) : null}
      <div>
        <dt className="font-medium text-neutral-950">{tCheckout("total")}</dt>
        <dd className="mt-0.5 tabular-nums text-neutral-950">{formatMoney(order.total, locale)}</dd>
      </div>
    </dl>
  );
}

function AmountRow({
  amount,
  kind,
  locale,
}: {
  amount: string;
  kind: PaperbasePrepaymentType;
  locale: Locale;
}) {
  const t = useTranslations("orderPayment");
  const label = kind === "delivery_only" ? t("amountDeliveryLabel") : t("amountFullLabel");
  return (
    <div className="mt-6 flex items-baseline justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-neutral-950">
        {formatMoney(amount, locale)}
      </span>
    </div>
  );
}

function FormView({
  order,
  locale,
  amount,
  kind,
  store,
  transactionId,
  payerNumber,
  onTransactionIdChange,
  onPayerNumberChange,
  onSubmit,
  submitting,
  fieldErrors,
  submitError,
  isResubmitting,
}: {
  order: PaperbaseOrderReceipt;
  locale: Locale;
  amount: string;
  kind: PaperbasePrepaymentType;
  store: PaperbaseStorePublic | null;
  transactionId: string;
  payerNumber: string;
  onTransactionIdChange: (value: string) => void;
  onPayerNumberChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  fieldErrors: FieldErrors;
  submitError: string | null;
  isResubmitting: boolean;
}) {
  const t = useTranslations("orderPayment");
  const inputClass =
    "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";
  const errorInputClass = "border-red-400 focus:border-red-500 focus:ring-red-500/10";

  return (
    <>
      <h1 className="text-xl font-semibold text-text">
        {isResubmitting ? t("resubmitTitle") : t("formTitle")}
      </h1>
      <p className="mt-3 text-sm text-neutral-600">
        {kind === "delivery_only" ? t("formIntroDelivery") : t("formIntroFull")}
      </p>

      <AmountRow amount={amount} kind={kind} locale={locale} />

      <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        <p className="font-medium text-neutral-950">{t("instructionsTitle")}</p>
        <p className="mt-1">
          {t("instructionsBody", { orderNumber: order.order_number })}
        </p>
        {store?.phone ? (
          <p className="mt-1">
            {t("instructionsPaymentNumber", { number: store.phone })}
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-5" noValidate>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-950">
            {t("transactionIdLabel")}
            <span className="text-red-600"> *</span>
          </span>
          <input
            className={cn(inputClass, fieldErrors.transaction_id ? errorInputClass : null)}
            name="transaction_id"
            value={transactionId}
            maxLength={100}
            onChange={(event) => onTransactionIdChange(event.target.value)}
            placeholder={t("transactionIdPlaceholder")}
            autoComplete="off"
            aria-invalid={fieldErrors.transaction_id ? true : undefined}
          />
          {fieldErrors.transaction_id ? (
            <span className="text-xs text-red-600">{fieldErrors.transaction_id}</span>
          ) : null}
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-950">
            {t("payerNumberLabel")}
            <span className="text-red-600"> *</span>
          </span>
          <input
            className={cn(inputClass, fieldErrors.payer_number ? errorInputClass : null)}
            name="payer_number"
            value={payerNumber}
            maxLength={32}
            onChange={(event) => onPayerNumberChange(event.target.value)}
            placeholder={t("payerNumberPlaceholder")}
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={fieldErrors.payer_number ? true : undefined}
          />
          {fieldErrors.payer_number ? (
            <span className="text-xs text-red-600">{fieldErrors.payer_number}</span>
          ) : null}
        </label>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? t("submitting") : t("submit")}
        </button>
      </form>
    </>
  );
}

function AwaitingView({
  order,
  locale,
  amount,
  kind,
  errorText,
}: {
  order: PaperbaseOrderReceipt;
  locale: Locale;
  amount: string;
  kind: PaperbasePrepaymentType;
  errorText: string | null;
}) {
  const t = useTranslations("orderPayment");
  const tCheckout = useTranslations("checkout");

  return (
    <>
      <h1 className="text-xl font-semibold text-text">{t("awaitingTitle")}</h1>
      <p className="mt-3 text-sm text-neutral-600">{t("awaitingBody")}</p>
      <p className="mt-2 text-sm text-neutral-600">{t("awaitingEmailHint")}</p>

      <AmountRow amount={amount} kind={kind} locale={locale} />

      <dl className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-600">
        <div>
          <dt className="font-medium text-neutral-950">{tCheckout("orderNumberLabel")}</dt>
          <dd className="mt-0.5">{order.order_number}</dd>
        </div>
        {order.transaction_id ? (
          <div>
            <dt className="font-medium text-neutral-950">{t("submittedTransactionLabel")}</dt>
            <dd className="mt-0.5 break-all">{order.transaction_id}</dd>
          </div>
        ) : null}
        {order.payer_number ? (
          <div>
            <dt className="font-medium text-neutral-950">{t("submittedPayerLabel")}</dt>
            <dd className="mt-0.5">{order.payer_number}</dd>
          </div>
        ) : null}
      </dl>

      {errorText ? <p className="mt-4 text-sm text-red-600">{errorText}</p> : null}

      <div className="mt-8 flex justify-center">
        <Link
          href="/"
          className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          {tCheckout("continueShoppingAfterOrder")}
        </Link>
      </div>
    </>
  );
}

function ConfirmedView({
  order,
  locale,
}: {
  order: PaperbaseOrderReceipt;
  locale: Locale;
}) {
  const t = useTranslations("orderPayment");
  const tCheckout = useTranslations("checkout");
  return (
    <>
      <h1 className="text-xl font-semibold text-text">{t("confirmedTitle")}</h1>
      <p className="mt-3 text-sm text-neutral-600">{t("confirmedBody")}</p>
      <OrderReceiptList order={order} locale={locale} />
      <Link
        href="/"
        className="mt-8 inline-flex rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900"
      >
        {tCheckout("continueShoppingAfterOrder")}
      </Link>
    </>
  );
}

function RejectedView({ order }: { order: PaperbaseOrderReceipt }) {
  const t = useTranslations("orderPayment");
  const tCheckout = useTranslations("checkout");

  return (
    <>
      <h1 className="text-xl font-semibold text-text">{t("rejectedTitle")}</h1>
      <p className="mt-3 text-sm text-neutral-600">{t("rejectedBody")}</p>

      <dl className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-600">
        <div>
          <dt className="font-medium text-neutral-950">{tCheckout("orderNumberLabel")}</dt>
          <dd className="mt-0.5">{order.order_number}</dd>
        </div>
      </dl>

      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-md bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-900"
        >
          {tCheckout("continueShoppingAfterOrder")}
        </Link>
      </div>
    </>
  );
}
