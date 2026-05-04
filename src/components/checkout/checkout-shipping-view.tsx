"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCart } from "@/hooks/useCart";
import { formatPaperbaseError, stockValidationErrors } from "@/lib/api/paperbase-errors";
import { apiFetchJson } from "@/lib/client/api";
import { createMfsOrder } from "@/lib/client/checkout-mfs-api";
import { reconcileCheckoutStock } from "@/lib/client/reconcile-checkout-stock";
import { formatMoney, parseDecimal } from "@/lib/format";
import { writeCheckoutSuccessMeta } from "@/lib/checkout/order-success-meta";
import { resolveStorefrontImageUrl, storefrontImageUnoptimized } from "@/lib/storefront-image";
import { triggerInitiateCheckout, triggerPurchase } from "@/lib/tracker";
import { getCheckoutCartItems, useCartStore } from "@/lib/store/cart-store";
import { cn } from "@/lib/utils";
import { Link, useRouter, type Locale } from "@/i18n/routing";
import type { CartItem } from "@/types/cart";
import type {
  CustomerFormVariant,
  PaperbaseOrderCreateResponse,
  PaperbaseShippingOption,
  PaperbaseShippingZone,
} from "@/types/paperbase";
import type { ProductPrepaymentType } from "@/types/product";

import { readStoredOrder, writeStoredOrder } from "@/components/orders/order-storage-keys";

import {
  CHECKOUT_DRAFT_STORAGE_KEY,
  CHECKOUT_PREPAYMENT_STORAGE_KEY,
  readMfsPendingOrderPublicId,
  writeMfsPendingOrderPublicId,
} from "./checkout-storage-keys";

function resolvePrepayment(items: CartItem[]): ProductPrepaymentType {
  let result: ProductPrepaymentType = "none";
  for (const item of items) {
    const kind = item.prepayment_type ?? "none";
    if (kind === "full") return "full";
    if (kind === "delivery_only") result = "delivery_only";
  }
  return result;
}

import { QuantityStepper } from "@/components/ui/quantity-stepper";

import { CheckoutBreadcrumbs } from "./checkout-breadcrumbs";
import { CheckoutLineVariants } from "./checkout-line-variants";

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

type CheckoutPaymentMethod = "cod" | "mfs";
type CheckoutPaymentOption = {
  id: CheckoutPaymentMethod;
  title: string;
  description: string;
  disabled: boolean;
  showComingSoon: boolean;
};

type CheckoutSummaryItemProps = {
  item: CartItem;
  locale: Locale;
  showRemoveLine: boolean;
  onIncrement: (item: CartItem) => void;
  onDecrement: (item: CartItem) => void;
  onRemove: (item: CartItem) => void;
};

function lineKeyForItem(item: CartItem): string {
  return item.line_key ?? `${item.product_public_id}-${item.variant_public_id ?? "default"}`;
}

const CheckoutSummaryItem = memo(function CheckoutSummaryItem({
  item,
  locale,
  showRemoveLine,
  onIncrement,
  onDecrement,
  onRemove,
}: CheckoutSummaryItemProps) {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const productT = useTranslations("product");
  const productHref = item.product_slug ? (`/products/${item.product_slug}` as const) : null;
  const imageSrc = resolveStorefrontImageUrl(item.image_url);

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex gap-2 sm:gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-card">
          <Image
            src={imageSrc}
            alt={item.name}
            fill
            sizes="80px"
            className="block object-contain p-1.5 mix-blend-multiply [-webkit-user-drag:none]"
            draggable={false}
            unoptimized={storefrontImageUnoptimized(imageSrc)}
          />
        </div>
        <div className="min-w-0 flex-1">
          {productHref ? (
            <Link
              href={productHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-fit max-w-full text-sm font-light leading-snug text-foreground underline decoration-muted-foreground decoration-1 underline-offset-[3px] hover:text-foreground hover:decoration-foreground"
            >
              {item.name}
            </Link>
          ) : (
            <p className="text-sm font-light leading-snug text-foreground">{item.name}</p>
          )}
          <CheckoutLineVariants item={item} />
          <p className="mt-3 text-xs font-normal text-muted-foreground">
            <span className="price-display-line">{formatMoney(item.price, locale)}</span>{" "}
            <span>{t("each")}</span>
          </p>
          <div className="mt-3">
            <QuantityStepper
              layout="segmented"
              quantity={item.quantity}
              onIncrement={() => onIncrement(item)}
              onDecrement={() => onDecrement(item)}
              increaseLabel={
                item.max_quantity != null && item.quantity >= item.max_quantity
                  ? productT("increaseQuantityDisabledMax")
                  : productT("increaseQuantity")
              }
              decreaseLabel={
                item.quantity <= 1
                  ? productT("decreaseQuantityDisabledMin")
                  : productT("decreaseQuantity")
              }
              decrementDisabled={item.quantity <= 1}
              incrementDisabled={item.max_quantity != null && item.quantity >= item.max_quantity}
            />
          </div>
        </div>
        {showRemoveLine ? (
          <div className="shrink-0 self-start pt-0.5">
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="text-xs font-medium text-muted-foreground underline decoration-muted-foreground underline-offset-2 transition-colors hover:text-primary"
            >
              {tCart("remove")}
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-3 border-t border-border pt-3 text-end text-xs font-normal text-muted-foreground">
        <span className="tabular-nums text-foreground">
          {formatMoney(parseDecimal(item.price) * item.quantity, locale)}
        </span>
      </p>
    </li>
  );
}, areSummaryItemsEqual);

function areSummaryItemsEqual(
  prev: Readonly<CheckoutSummaryItemProps>,
  next: Readonly<CheckoutSummaryItemProps>,
) {
  return (
    prev.locale === next.locale &&
    prev.showRemoveLine === next.showRemoveLine &&
    prev.onIncrement === next.onIncrement &&
    prev.onDecrement === next.onDecrement &&
    prev.onRemove === next.onRemove &&
    prev.item.product_public_id === next.item.product_public_id &&
    prev.item.variant_public_id === next.item.variant_public_id &&
    prev.item.product_slug === next.item.product_slug &&
    prev.item.image_url === next.item.image_url &&
    prev.item.name === next.item.name &&
    prev.item.price === next.item.price &&
    prev.item.quantity === next.item.quantity &&
    prev.item.max_quantity === next.item.max_quantity &&
    prev.item.line_key === next.item.line_key
  );
}

export function CheckoutShippingView({
  customerFormVariant = "extended",
}: {
  customerFormVariant?: CustomerFormVariant;
}) {
  const variant = customerFormVariant ?? "extended";
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const tStates = useTranslations("states");
  const productT = useTranslations("product");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const {
    checkoutItems,
    checkoutSubtotal,
    hydrated,
    increment,
    decrement,
    removeItem,
  } = useCart();
  const [zones, setZones] = useState<Array<{ zone_public_id: string; name: string }>>([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [shippingCost, setShippingCost] = useState("0.00");
  const [finalTotal, setFinalTotal] = useState("0.00");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [stockAdjustedHint, setStockAdjustedHint] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("cod");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const shippingOptionsCacheRef = useRef(new Map<string, PaperbaseShippingOption[]>());
  const shippingOptionsInFlightRef = useRef(new Map<string, Promise<PaperbaseShippingOption[]>>());
  const hasFiredInitiateRef = useRef(false);

  const cartItems = useMemo(
    () =>
      checkoutItems.map((item) => ({
        product_public_id: item.product_public_id,
        variant_public_id: item.variant_public_id,
        quantity: item.quantity,
      })),
    [checkoutItems],
  );
  const pricingCartKey = useMemo(
    () =>
      checkoutItems
        .map((item) => `${item.product_public_id}:${item.variant_public_id ?? ""}:${item.quantity}`)
        .sort()
        .join("|"),
    [checkoutItems],
  );

  const resolvedPrepayment = useMemo(
    () => resolvePrepayment(checkoutItems),
    [checkoutItems],
  );
  const requiresPrepayment = resolvedPrepayment !== "none";

  useEffect(() => {
    setPaymentMethod(requiresPrepayment ? "mfs" : "cod");
  }, [requiresPrepayment]);

  const getShippingOptionsForZone = useCallback(async (zonePublicId: string) => {
    const cached = shippingOptionsCacheRef.current.get(zonePublicId);
    if (cached) {
      return cached;
    }
    const inFlight = shippingOptionsInFlightRef.current.get(zonePublicId);
    if (inFlight) {
      return inFlight;
    }
    const request = apiFetchJson<PaperbaseShippingOption[]>(
      `/checkout/shipping/options?zone_public_id=${encodeURIComponent(zonePublicId)}`,
    )
      .then((options) => {
        shippingOptionsCacheRef.current.set(zonePublicId, options);
        return options;
      })
      .finally(() => {
        shippingOptionsInFlightRef.current.delete(zonePublicId);
      });
    shippingOptionsInFlightRef.current.set(zonePublicId, request);
    return request;
  }, []);

  useEffect(() => {
    if (!hydrated || checkoutItems.length === 0 || hasFiredInitiateRef.current) {
      return;
    }
    triggerInitiateCheckout({
      value: Number(finalTotal || checkoutSubtotal),
      items: checkoutItems.map((item) => ({
        id: item.product_public_id,
        quantity: item.quantity,
        item_price: Number(item.price),
      })),
    });
    hasFiredInitiateRef.current = true;
  }, [hydrated, checkoutItems, checkoutSubtotal]);

  useEffect(() => {
    let mounted = true;
    async function loadZones() {
      if (!hydrated || checkoutItems.length === 0) {
        return;
      }
      try {
        const response = await apiFetchJson<PaperbaseShippingZone[]>("/checkout/shipping/zones");
        if (!mounted) return;
        const activeZones = response
          .filter((zone) => zone.is_active)
          .map((zone) => ({ zone_public_id: zone.zone_public_id, name: zone.name }));
        setZones(activeZones);
        if (activeZones[0]) {
          setSelectedZone(activeZones[0].zone_public_id);
          // Warm shipping options cache for immediate zone selection UX.
          void getShippingOptionsForZone(activeZones[0].zone_public_id).catch(() => {});
          for (const zone of activeZones.slice(1)) {
            void getShippingOptionsForZone(zone.zone_public_id).catch(() => {});
          }
        }
      } catch {
        if (!mounted) return;
        setErrorText(t("errorShippingZonesLoad"));
      }
    }
    loadZones();
    return () => {
      mounted = false;
    };
  }, [getShippingOptionsForZone, hydrated, checkoutItems.length, t]);

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      if (!selectedZone) {
        return;
      }
      setSelectedMethod("");
      setLoading(true);
      setErrorText(null);
      try {
        const options = await getShippingOptionsForZone(selectedZone);
        if (!mounted) return;
        const firstId = options[0]?.method_public_id ?? "";
        setSelectedMethod(firstId);
      } catch {
        if (!mounted) return;
        setErrorText(t("errorShippingZoneOptionsLoad"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadOptions();
    return () => {
      mounted = false;
    };
  }, [getShippingOptionsForZone, selectedZone, t]);

  const selectedMethodRef = useRef(selectedMethod);
  selectedMethodRef.current = selectedMethod;
  const selectedZoneRef = useRef(selectedZone);
  selectedZoneRef.current = selectedZone;
  const tRef = useRef(t);
  tRef.current = t;
  const initiateAbortRef = useRef<AbortController | null>(null);
  const initiateRequestIdRef = useRef(0);

  useEffect(() => {
    if (loading || !selectedZone || !selectedMethod) {
      return;
    }
    let mounted = true;
    const requestId = ++initiateRequestIdRef.current;
    const tid = window.setTimeout(() => {
      void (async () => {
        const zone = selectedZoneRef.current;
        if (!zone) {
          return;
        }
        const controller = new AbortController();
        initiateAbortRef.current?.abort();
        initiateAbortRef.current = controller;

        const { setLineQuantity } = useCartStore.getState();
        const scope = useCartStore.getState().buyNowMap != null ? "checkout" : "cart";
        const snapshot = getCheckoutCartItems();
        const snapshotItems = snapshot.map((item) => ({
          product_public_id: item.product_public_id,
          variant_public_id: item.variant_public_id,
          quantity: item.quantity,
        }));
        if (!snapshot.length) {
          if (mounted) {
            setShippingCost("0.00");
            setFinalTotal("0.00");
          }
          return;
        }

        try {
          const [changed, response] = await Promise.all([
            reconcileCheckoutStock(snapshot, { setLineQuantity, scope }),
            apiFetchJson<{
              shipping_cost: string;
              final_total: string;
            }>("/checkout/initiate", {
              method: "POST",
              body: JSON.stringify({
                items: snapshotItems,
                shipping_zone_public_id: zone,
                shipping_method_public_id: selectedMethodRef.current || undefined,
              }),
              signal: controller.signal,
            }),
          ]);
          if (!mounted || requestId !== initiateRequestIdRef.current || controller.signal.aborted) return;
          if (changed) {
            setStockAdjustedHint(tRef.current("stockAdjustedForCheckout"));
          }

          if (!snapshotItems.length) {
            setShippingCost("0.00");
            setFinalTotal("0.00");
            setErrorText(null);
            return;
          }
          setShippingCost(response.shipping_cost);
          setFinalTotal(response.final_total);
          setErrorText(null);
        } catch (err) {
          if (!mounted || requestId !== initiateRequestIdRef.current) return;
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          const stockErrs = stockValidationErrors(err);
          setErrorText(
            stockErrs.length ? stockErrs.join(" | ") : formatPaperbaseError(err),
          );
        } finally {
          if (initiateAbortRef.current === controller) {
            initiateAbortRef.current = null;
          }
        }
      })();
    }, 320);
    return () => {
      mounted = false;
      window.clearTimeout(tid);
      initiateAbortRef.current?.abort();
    };
  }, [loading, pricingCartKey, selectedMethod, selectedZone]);

  const handleIncrement = useCallback(
    (item: CartItem) => {
      increment(item.product_public_id, item.variant_public_id, "checkout");
    },
    [increment],
  );

  const handleDecrement = useCallback(
    (item: CartItem) => {
      decrement(item.product_public_id, item.variant_public_id, "checkout");
    },
    [decrement],
  );

  const handleRemove = useCallback(
    (item: CartItem) => {
      removeItem(item.product_public_id, item.variant_public_id, "checkout");
    },
    [removeItem],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) {
      return;
    }
    if (!selectedZone) {
      setErrorText(t("errorShippingZoneRequired"));
      return;
    }
    const formData = new FormData(form);
    if (variant === "minimal") {
      const fullName = String(formData.get("fullName") || "").trim();
      if (!fullName) {
        setErrorText(t("errorFullNameRequired"));
        return;
      }
    }
    const phone = String(formData.get("phone") || "").trim();
    const district = String(formData.get("district") || "").trim();

    const shipping_name =
      variant === "minimal"
        ? String(formData.get("fullName") ?? "").trim()
        : `${String(formData.get("firstName") || "").trim()} ${String(
            formData.get("lastName") || "",
          ).trim()}`.trim();

    const addressLine = String(formData.get("shippingAddress") || "").trim();
    const thana = String(formData.get("thana") || "").trim();
    const shipping_address =
      variant === "minimal"
        ? String(formData.get("thana") ?? "").trim()
        : [addressLine, thana].filter(Boolean).join(", ");

    const email = String(formData.get("email") || "").trim();

    const draft: CheckoutDraft = {
      shipping_zone_public_id: selectedZone,
      shipping_method_public_id: selectedMethod || undefined,
      shipping_name,
      phone,
      email: variant === "minimal" ? undefined : email || undefined,
      shipping_address,
      district: district || undefined,
      products: cartItems,
    };

    if (paymentMethod === "mfs") {
      // MFS path — create order and go directly to MFS payment
      setOrderLoading(true);
      setOrderError(null);
      try {
        window.sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        window.sessionStorage.setItem(
          CHECKOUT_PREPAYMENT_STORAGE_KEY,
          resolvePrepayment(checkoutItems),
        );

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
          useCartStore.getState().clear();
          router.replace(`/success/${order.public_id}`);
          return;
        }

        writeStoredOrder(order);
        writeMfsPendingOrderPublicId(order.public_id);
        useCartStore.getState().clear();
        router.push(`/checkout/payment/mfs?orderId=${encodeURIComponent(order.public_id)}`);
      } catch (error) {
        const stockErrors = stockValidationErrors(error);
        setOrderError(
          stockErrors.length ? stockErrors.join(" | ") : formatPaperbaseError(error),
        );
      } finally {
        setOrderLoading(false);
      }
      return;
    }

    setOrderLoading(true);
    setOrderError(null);
    try {
      const order = await apiFetchJson<PaperbaseOrderCreateResponse>("/checkout/order", {
        method: "POST",
        body: JSON.stringify({ ...draft, payment_method: "cod" }),
      });
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(CHECKOUT_PREPAYMENT_STORAGE_KEY);
      writeStoredOrder(order);
      writeCheckoutSuccessMeta(order.public_id, { payment_method: "cod" });
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
      useCartStore.getState().clear();
      router.replace(`/success/${order.public_id}`);
    } catch (error) {
      const stockErrors = stockValidationErrors(error);
      setOrderError(
        stockErrors.length ? stockErrors.join(" | ") : formatPaperbaseError(error),
      );
    } finally {
      setOrderLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">{tStates("loading")}</div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="mb-6 text-foreground">{t("empty")}</p>
        <Link
          href="/#products"
          className="inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/10";

  const shellCard = "rounded-lg border border-border bg-card shadow-sm";

  const orderTotalRows = (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-normal text-muted-foreground">{t("subtotal")}</dt>
        <dd className="price-display-summary shrink-0 text-end">{formatMoney(checkoutSubtotal, locale)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-normal text-muted-foreground">{t("shippingLine")}</dt>
        <dd className="price-display-summary shrink-0 text-end">{formatMoney(shippingCost, locale)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
        <dt className="text-sm font-normal text-foreground">{t("total")}</dt>
        <dd className="price-display-total shrink-0 text-end leading-none !text-primary">
          {formatMoney(finalTotal, locale)}
        </dd>
      </div>
    </>
  );

  return (
    <div className="min-w-0 max-w-full pb-12 pt-6 md:pb-16 md:pt-8">
      <CheckoutBreadcrumbs step="shipping" />

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="mx-auto grid w-full min-w-0 max-w-5xl gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8"
      >
        <div className="lg:relative">
          <aside
            className={cn(
              "flex min-h-0 min-w-0 flex-col",
              shellCard,
              "p-5 sm:p-6",
              "lg:absolute lg:inset-0 lg:overflow-hidden",
            )}
          >
          <h2 className="shrink-0 text-xl font-semibold tracking-normal uppercase text-foreground">
            {t("orderSummary")}
          </h2>

          <ul className="checkout-summary-scroll mt-5 space-y-4 max-lg:max-h-[60vh] max-lg:overflow-y-auto max-lg:pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {checkoutItems.map((item) => (
              <CheckoutSummaryItem
                key={lineKeyForItem(item)}
                item={item}
                locale={locale}
                showRemoveLine={checkoutItems.length > 1}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onRemove={handleRemove}
              />
            ))}
          </ul>

          <dl
            className={cn(
              "mt-6 shrink-0 space-y-2.5 border-t border-border pt-5 text-sm",
              "max-lg:hidden",
            )}
          >
            {orderTotalRows}
          </dl>
          {stockAdjustedHint ? (
            <p className="mt-3 max-lg:hidden shrink-0 text-xs font-medium text-primary">{stockAdjustedHint}</p>
          ) : null}
          {errorText ? (
            <p className="mt-2 max-lg:hidden shrink-0 text-sm text-danger">{errorText}</p>
          ) : null}
          </aside>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-6 lg:h-full">
          <section className={cn("shrink-0", shellCard, "p-5 sm:p-6")}>
            <h1 className="text-xl font-semibold tracking-normal uppercase text-foreground">
              {t("customerInfoTitle")}
            </h1>
            <div className="mt-6 grid gap-5">
              {variant === "extended" ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("firstName")}
                      <span className="text-accent"> *</span>
                    </span>
                    <input
                      className={inputClass}
                      name="firstName"
                      required
                      autoComplete="given-name"
                      placeholder={t("firstNamePlaceholder")}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("lastName")}
                      <span className="text-accent"> *</span>
                    </span>
                    <input
                      className={inputClass}
                      name="lastName"
                      required
                      autoComplete="family-name"
                      placeholder={t("lastNamePlaceholder")}
                    />
                  </label>
                </div>
              ) : (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("fullName")}
                    <span className="text-accent"> *</span>
                  </span>
                  <input
                    className={inputClass}
                    name="fullName"
                    required
                    autoComplete="name"
                    placeholder={t("fullNamePlaceholder")}
                  />
                </label>
              )}
              {variant === "extended" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">{t("email")}</span>
                  <input
                    className={inputClass}
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t("emailPlaceholder")}
                  />
                </label>
              ) : null}
              <div className="grid min-w-0 gap-2">
                <span className="text-sm font-medium text-foreground">
                  {t("phone")}
                  <span className="text-accent"> *</span>
                </span>
                <div className="flex min-w-0 gap-2">
                  {variant === "extended" ? (
                    <>
                      <input type="hidden" name="dial" value="+880" />
                      <span
                        className={cn(
                          inputClass,
                          "inline-flex max-w-[7.5rem] shrink-0 cursor-default select-none items-center text-muted-foreground sm:max-w-[8.5rem]",
                        )}
                      >
                        {t("dialOption_bd")}
                      </span>
                    </>
                  ) : null}
                  <input
                    className={cn(
                      inputClass,
                      variant === "extended" ? "min-w-0 flex-1" : "w-full",
                    )}
                    name="phone"
                    type="tel"
                    required
                    pattern="01[0-9]{9}"
                    maxLength={11}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder={t("phonePlaceholder")}
                    aria-label={
                      variant === "extended"
                        ? `${t("dialOption_bd")} ${t("phone")}`
                        : t("phone")
                    }
                  />
                </div>
              </div>
              {variant === "extended" ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("thana")}
                      <span className="text-accent"> *</span>
                    </span>
                    <input
                      className={inputClass}
                      name="thana"
                      required
                      autoComplete="address-line2"
                      placeholder={t("thanaPlaceholder")}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("district")}
                      <span className="text-accent"> *</span>
                    </span>
                    <input
                      className={inputClass}
                      name="district"
                      required
                      autoComplete="address-level1"
                      placeholder={t("districtPlaceholder")}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("thana")}
                      <span className="text-accent"> *</span>
                    </span>
                    <input
                      className={inputClass}
                      name="thana"
                      required
                      autoComplete="address-line2"
                      placeholder={t("thanaPlaceholder")}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("district")}
                      <span className="text-accent"> *</span>
                    </span>
                    <input
                      className={inputClass}
                      name="district"
                      required
                      autoComplete="address-level1"
                      placeholder={t("districtPlaceholder")}
                    />
                  </label>
                </>
              )}
              {variant === "extended" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("addressField")}
                    <span className="text-accent"> *</span>
                  </span>
                  <textarea
                    className={cn(inputClass, "min-h-[5.5rem] resize-y")}
                    name="shippingAddress"
                    rows={3}
                    required
                    placeholder={t("addressPlaceholder")}
                  />
                </label>
              ) : null}
            </div>
          </section>

          <div className="flex min-h-0 flex-col gap-6 lg:flex-1 lg:justify-end">
            <section className={cn(shellCard, "p-5 sm:p-6")}>
              <h2 className="text-base font-semibold text-foreground">{t("shippingZone")}</h2>
              <fieldset className="mt-4 grid gap-3">
                <legend className="sr-only">{t("shippingZone")}</legend>
                {zones.map((zone) => {
                  const selected = selectedZone === zone.zone_public_id;
                  return (
                    <label
                      key={zone.zone_public_id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors",
                        selected
                          ? "border-border bg-primary/10"
                          : "border-border bg-card hover:border-border",
                      )}
                    >
                      <input
                        type="radio"
                        name="shippingZonePick"
                        value={zone.zone_public_id}
                        checked={selected}
                        onChange={() => setSelectedZone(zone.zone_public_id)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="text-sm font-medium text-foreground">{zone.name}</span>
                    </label>
                  );
                })}
              </fieldset>
            </section>

            <section className={cn("shrink-0", shellCard, "p-5 sm:p-6")}>
              <h2 className="text-base font-semibold text-foreground">{t("paymentMethodSection")}</h2>
              <fieldset className="mt-4 grid gap-3">
                <legend className="sr-only">{t("paymentMethodSection")}</legend>
                {(() => {
                  const options: CheckoutPaymentOption[] = [
                    {
                      id: "cod",
                      title: t("paymentCodTitle"),
                      description: requiresPrepayment
                        ? t("paymentCodDisabledPrepayment")
                        : t("paymentCodDescription"),
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
              </fieldset>
            </section>

            <div
              className={cn(
                shellCard,
                "hidden max-lg:block shrink-0 p-5 sm:p-6",
              )}
            >
              <dl className="space-y-2.5 text-sm">{orderTotalRows}</dl>
            </div>

            {stockAdjustedHint ? (
              <p className="shrink-0 text-xs font-medium text-primary">{stockAdjustedHint}</p>
            ) : null}
            {errorText ? <p className="shrink-0 text-sm text-danger">{errorText}</p> : null}

            {orderError ? <p className="shrink-0 text-sm text-danger">{orderError}</p> : null}

            <button
              type="submit"
              disabled={loading || orderLoading}
              className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {orderLoading ? (
                <>
                  <Loader2 className="size-5 shrink-0 animate-spin" strokeWidth={2.25} aria-hidden />
                  <span>{t("placingOrder")}</span>
                </>
              ) : paymentMethod === "mfs" ? (
                t("continueToPayment")
              ) : (
                t("placeOrder")
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
