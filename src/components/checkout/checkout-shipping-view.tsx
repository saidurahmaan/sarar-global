"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCart } from "@/hooks/useCart";
import { apiFetchJson } from "@/lib/client/api";
import { formatMoney, parseDecimal } from "@/lib/format";
import { resolveStorefrontImageUrl, storefrontImageUnoptimized } from "@/lib/storefront-image";
import { triggerInitiateCheckout } from "@/lib/tracker";
import { cn } from "@/lib/utils";
import { Link, useRouter, type Locale } from "@/i18n/routing";
import type { CartItem } from "@/types/cart";
import type { PaperbaseShippingOption, PaperbaseShippingZone } from "@/types/paperbase";
import type { ProductPrepaymentType } from "@/types/product";

import {
  CHECKOUT_DRAFT_STORAGE_KEY,
  CHECKOUT_PREPAYMENT_STORAGE_KEY,
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

export function CheckoutShippingView() {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const tStates = useTranslations("states");
  const productT = useTranslations("product");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const { checkoutItems, checkoutSubtotal, isBuyNow, hydrated, increment, decrement, removeItem, clearBuyNow } =
    useCart();
  const [zones, setZones] = useState<Array<{ zone_public_id: string; name: string }>>([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [shippingCost, setShippingCost] = useState("0.00");
  const [finalTotal, setFinalTotal] = useState("0.00");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const cartItems = useMemo(
    () =>
      checkoutItems.map((item) => ({
        product_public_id: item.product_public_id,
        variant_public_id: item.variant_public_id,
        quantity: item.quantity,
      })),
    [checkoutItems],
  );

  useEffect(() => {
    if (!hydrated || checkoutItems.length === 0) {
      return;
    }
    triggerInitiateCheckout(checkoutItems);
  }, [hydrated, checkoutItems]);

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
        }
      } catch {
        if (!mounted) return;
        setErrorText("Failed to load shipping zones.");
      }
    }
    loadZones();
    return () => {
      mounted = false;
    };
  }, [hydrated, checkoutItems.length]);

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      if (!selectedZone) {
        return;
      }
      setLoading(true);
      setErrorText(null);
      try {
        const options = await apiFetchJson<PaperbaseShippingOption[]>(
          `/checkout/shipping/options?zone_public_id=${encodeURIComponent(selectedZone)}`,
        );
        if (!mounted) return;
        const firstId = options[0]?.method_public_id ?? "";
        setSelectedMethod(firstId);
      } catch {
        if (!mounted) return;
        setErrorText("Failed to load shipping for this zone.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadOptions();
    return () => {
      mounted = false;
    };
  }, [selectedZone]);

  const cartItemsRef = useRef(cartItems);
  cartItemsRef.current = cartItems;
  const selectedMethodRef = useRef(selectedMethod);
  selectedMethodRef.current = selectedMethod;
  const selectedZoneRef = useRef(selectedZone);
  selectedZoneRef.current = selectedZone;

  useEffect(() => {
    let mounted = true;
    const tid = window.setTimeout(() => {
      const items = cartItemsRef.current;
      const zone = selectedZoneRef.current;
      const method = selectedMethodRef.current;
      if (!items.length || !zone) {
        return;
      }
      void (async () => {
        try {
          const response = await apiFetchJson<{
            shipping_cost: string;
            final_total: string;
          }>("/checkout/initiate", {
            method: "POST",
            body: JSON.stringify({
              items,
              shipping_zone_public_id: zone || undefined,
              shipping_method_public_id: method || undefined,
            }),
          });
          if (!mounted) return;
          setShippingCost(response.shipping_cost);
          setFinalTotal(response.final_total);
        } catch {
          if (!mounted) return;
          setErrorText("Failed to calculate pricing.");
        }
      })();
    }, 320);
    return () => {
      mounted = false;
      window.clearTimeout(tid);
    };
  }, [cartItems, selectedMethod, selectedZone]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) {
      return;
    }
    if (!selectedZone) {
      setErrorText("Please choose a shipping zone.");
      return;
    }
    const formData = new FormData(form);
    const shipping_name = `${String(formData.get("firstName") || "").trim()} ${String(
      formData.get("lastName") || "",
    ).trim()}`.trim();
    const phone = String(formData.get("phone") || "").trim();
    const addressLine = String(formData.get("shippingAddress") || "").trim();
    const thana = String(formData.get("thana") || "").trim();
    const shipping_address = [addressLine, thana].filter(Boolean).join(", ");
    const email = String(formData.get("email") || "").trim();
    const district = String(formData.get("district") || "").trim();

    const draft: CheckoutDraft = {
      shipping_zone_public_id: selectedZone,
      shipping_method_public_id: selectedMethod || undefined,
      shipping_name,
      phone,
      email: email || undefined,
      shipping_address,
      district: district || undefined,
      products: cartItems,
    };
    window.sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    // Pin the resolved prepayment for this order BEFORE clearing the Buy Now map,
    // so the payment step can reflect it even after the transient cart source is gone.
    window.sessionStorage.setItem(
      CHECKOUT_PREPAYMENT_STORAGE_KEY,
      resolvePrepayment(checkoutItems),
    );
    // Buy Now session is captured in the draft — release the temporary map
    clearBuyNow();
    router.push("/checkout/payment");
  }

  if (!hydrated) {
    return (
      <div className="py-16 text-center text-sm text-neutral-600">{tStates("loading")}</div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="mb-6 text-neutral-700">{t("empty")}</p>
        <Link
          href="/#products"
          className="inline-flex rounded-lg bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-900"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

  const shellCard = "rounded-lg border border-neutral-200 bg-white shadow-sm";

  const orderTotalRows = (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-normal text-neutral-500">{t("subtotal")}</dt>
        <dd className="price-display-summary shrink-0 text-end">{formatMoney(checkoutSubtotal, locale)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-normal text-neutral-500">{t("shippingLine")}</dt>
        <dd className="price-display-summary shrink-0 text-end">{formatMoney(shippingCost, locale)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-neutral-200 pt-3">
        <dt className="text-sm font-normal text-neutral-700">{t("total")}</dt>
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
        onSubmit={handleSubmit}
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
          <h2 className="shrink-0 text-lg font-semibold tracking-tight text-neutral-950">{t("orderSummary")}</h2>

          <ul className="checkout-summary-scroll mt-5 space-y-4 max-lg:max-h-[60vh] max-lg:overflow-y-auto max-lg:pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {checkoutItems.map((item) => {
              const productHref = item.product_slug ? (`/products/${item.product_slug}` as const) : null;
              const imageSrc = resolveStorefrontImageUrl(item.image_url);
              // In Buy Now mode quantities are fixed; remove button is also hidden
              const showRemoveLine = !isBuyNow && checkoutItems.length > 1;
              return (
                <li
                  key={item.line_key ?? `${item.product_public_id}-${item.variant_public_id ?? "default"}`}
                  className="rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <div className="flex gap-2 sm:gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-neutral-100 bg-neutral-50">
                      <Image
                        src={imageSrc}
                        alt={item.name}
                        fill
                        sizes="80px"
                        className="object-contain p-1.5"
                        unoptimized={storefrontImageUnoptimized(imageSrc)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      {productHref ? (
                        <Link
                          href={productHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-fit max-w-full text-sm font-light leading-snug text-neutral-900 underline decoration-neutral-400 decoration-1 underline-offset-[3px] hover:text-neutral-950 hover:decoration-neutral-800"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <p className="text-sm font-light leading-snug text-neutral-900">{item.name}</p>
                      )}
                      <CheckoutLineVariants item={item} />
                      <p className="mt-3 text-xs font-normal text-neutral-500">
                        <span className="price-display-line">{formatMoney(item.price, locale)}</span>{" "}
                        <span>{t("each")}</span>
                      </p>
                      <div className="mt-3">
                        <QuantityStepper
                          layout="segmented"
                          quantity={item.quantity}
                          onIncrement={() => increment(item.product_public_id, item.variant_public_id)}
                          onDecrement={() => decrement(item.product_public_id, item.variant_public_id)}
                          increaseLabel={
                            isBuyNow
                              ? productT("increaseQuantityDisabledMax")
                              : item.max_quantity != null && item.quantity >= item.max_quantity
                                ? productT("increaseQuantityDisabledMax")
                                : productT("increaseQuantity")
                          }
                          decreaseLabel={
                            isBuyNow || item.quantity <= 1
                              ? productT("decreaseQuantityDisabledMin")
                              : productT("decreaseQuantity")
                          }
                          decrementDisabled={isBuyNow || item.quantity <= 1}
                          incrementDisabled={
                            isBuyNow ||
                            (item.max_quantity != null && item.quantity >= item.max_quantity)
                          }
                        />
                      </div>
                    </div>
                    {showRemoveLine ? (
                      <div className="shrink-0 self-start pt-0.5">
                        <button
                          type="button"
                          onClick={() => removeItem(item.product_public_id, item.variant_public_id)}
                          className="text-xs font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-primary"
                        >
                          {tCart("remove")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 border-t border-neutral-100 pt-3 text-end text-xs font-normal text-neutral-500">
                    <span className="tabular-nums text-neutral-700">
                      {formatMoney(parseDecimal(item.price) * item.quantity, locale)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>

          <dl
            className={cn(
              "mt-6 shrink-0 space-y-2.5 border-t border-neutral-200 pt-5 text-sm",
              "max-lg:hidden",
            )}
          >
            {orderTotalRows}
          </dl>
          </aside>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-6 lg:h-full">
          <section className={cn("shrink-0", shellCard, "p-5 sm:p-6")}>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-950">{t("customerInfoTitle")}</h1>
            <div className="mt-6 grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-neutral-950">
                    {t("firstName")}
                    <span className="text-red-600"> *</span>
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
                  <span className="text-sm font-medium text-neutral-950">
                    {t("lastName")}
                    <span className="text-red-600"> *</span>
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
              <label className="grid gap-2">
                <span className="text-sm font-medium text-neutral-950">{t("email")}</span>
                <input
                  className={inputClass}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                />
              </label>
              <div className="grid min-w-0 gap-2">
                <span className="text-sm font-medium text-neutral-950">
                  {t("phone")}
                  <span className="text-red-600"> *</span>
                </span>
                <div className="flex min-w-0 gap-2">
                  <input type="hidden" name="dial" value="+880" />
                  <span
                    className={cn(
                      inputClass,
                      "inline-flex max-w-[7.5rem] shrink-0 cursor-default select-none items-center text-neutral-600 sm:max-w-[8.5rem]",
                    )}
                  >
                    {t("dialOption_bd")}
                  </span>
                  <input
                    className={cn(inputClass, "min-w-0 flex-1")}
                    name="phone"
                    type="tel"
                    required
                    pattern="01[0-9]{9}"
                    maxLength={11}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder={t("phonePlaceholder")}
                    aria-label={`${t("dialOption_bd")} ${t("phone")}`}
                  />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-neutral-950">
                    {t("thana")}
                    <span className="text-red-600"> *</span>
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
                  <span className="text-sm font-medium text-neutral-950">
                    {t("district")}
                    <span className="text-red-600"> *</span>
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
              <label className="grid gap-2">
                <span className="text-sm font-medium text-neutral-950">
                  {t("addressField")}
                  <span className="text-red-600"> *</span>
                </span>
                <textarea
                  className={cn(inputClass, "min-h-[5.5rem] resize-y")}
                  name="shippingAddress"
                  rows={3}
                  required
                  placeholder={t("addressPlaceholder")}
                />
              </label>
            </div>
          </section>

          <div className="flex min-h-0 flex-col gap-6 lg:flex-1 lg:justify-end">
            <section className={cn(shellCard, "p-5 sm:p-6")}>
              <h2 className="text-base font-semibold text-neutral-950">{t("shippingZone")}</h2>
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
                          ? "border-neutral-200 bg-primary/10"
                          : "border-neutral-200 bg-white hover:border-neutral-300",
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
                      <span className="text-sm font-medium text-neutral-950">{zone.name}</span>
                    </label>
                  );
                })}
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

            {errorText ? <p className="shrink-0 text-sm text-red-600">{errorText}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {t("continueToPayment")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
