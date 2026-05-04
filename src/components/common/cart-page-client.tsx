"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useCart } from "@/hooks/useCart";
import { Link, type Locale } from "@/i18n/routing";
import { formatMoney, parseDecimal } from "@/lib/format";
import { resolveStorefrontImageUrl, storefrontImageUnoptimized } from "@/lib/storefront-image";
import { parseVariantAttributePairs } from "@/lib/variant-details";
import { Button, buttonVariants } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { cn } from "@/lib/utils";

function lineTotal(price: string, quantity: number) {
  return parseDecimal(price) * quantity;
}

export function CartPageClient() {
  const t = useTranslations("cart");
  const tCheckout = useTranslations("checkout");
  const states = useTranslations("states");
  const productT = useTranslations("product");
  const locale = useLocale() as Locale;

  const { items, hydrated, subtotal, removeItem, increment, decrement } = useCart();

  return (
    <div className="bg-card">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-6">
        <h1 className="text-3xl font-normal tracking-tight text-foreground md:text-4xl">{t("title")}</h1>
        <Link
          href="/#products"
          className="text-sm font-medium text-muted-foreground underline decoration-muted-foreground underline-offset-4 hover:text-foreground"
        >
          {tCheckout("continueShopping")}
        </Link>
      </div>

      {!hydrated ? (
        <p className="py-10 text-sm text-foreground/70">{states("loading")}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-sm text-foreground/70">{t("empty")}</p>
      ) : (
        <>
          {/* Desktop table-like layout */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[minmax(0,1fr)_12rem_10rem] gap-6 pt-6 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <p>Product</p>
              <p className="text-center">Quantity</p>
              <p className="text-right">Total</p>
            </div>

            <div className="divide-y divide-border">
              {items.map((item) => {
                const imageSrc = resolveStorefrontImageUrl(item.image_url);
                const variantPairs = parseVariantAttributePairs(item.variant_details);
                const href = item.product_slug ? `/products/${item.product_slug}` : null;
                const total = lineTotal(item.price, item.quantity);

                return (
                  <div
                    key={`${item.product_public_id}-${item.variant_public_id ?? "default"}`}
                    className="grid grid-cols-[minmax(0,1fr)_12rem_10rem] gap-6 py-8"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-card">
                        <Image
                          src={imageSrc}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="block object-contain p-2 mix-blend-multiply [-webkit-user-drag:none]"
                          draggable={false}
                          unoptimized={storefrontImageUnoptimized(imageSrc)}
                        />
                      </div>

                      <div className="min-w-0">
                        {href ? (
                          <Link href={href} className="block text-sm font-semibold text-foreground hover:underline">
                            {item.name}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-foreground">{item.name}</p>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">{formatMoney(item.price, locale)}</p>

                        {variantPairs.length > 0 ? (
                          <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                            {variantPairs.map((pair, idx) => (
                              <p key={`${pair.label}-${pair.value}-${idx}`}>
                                {pair.label ? `${pair.label.toUpperCase()}: ` : ""}
                                {pair.value}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                      <QuantityStepper
                        quantity={item.quantity}
                        onIncrement={() => increment(item.product_public_id, item.variant_public_id)}
                        onDecrement={() => decrement(item.product_public_id, item.variant_public_id)}
                        increaseLabel={
                          item.max_quantity != null && item.quantity >= item.max_quantity
                            ? productT("increaseQuantityDisabledMax")
                            : productT("increaseQuantity")
                        }
                        decreaseLabel={
                          item.quantity <= 1 ? productT("decreaseQuantityDisabledMin") : productT("decreaseQuantity")
                        }
                        decrementDisabled={item.quantity <= 1}
                        incrementDisabled={item.max_quantity != null && item.quantity >= item.max_quantity}
                        layout="segmented"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => removeItem(item.product_public_id, item.variant_public_id)}
                        aria-label={t("remove")}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>

                    <p className="text-right text-sm font-semibold text-foreground">{formatMoney(total, locale)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile stacked layout */}
          <div className="md:hidden">
            <div className="divide-y divide-border">
              {items.map((item) => {
                const imageSrc = resolveStorefrontImageUrl(item.image_url);
                const variantPairs = parseVariantAttributePairs(item.variant_details);
                const href = item.product_slug ? `/products/${item.product_slug}` : null;
                const total = lineTotal(item.price, item.quantity);

                return (
                  <div
                    key={`${item.product_public_id}-${item.variant_public_id ?? "default"}`}
                    className="py-6"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-card">
                        <Image
                          src={imageSrc}
                          alt={item.name}
                          fill
                          sizes="64px"
                          className="block object-contain p-2 mix-blend-multiply [-webkit-user-drag:none]"
                          draggable={false}
                          unoptimized={storefrontImageUnoptimized(imageSrc)}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {href ? (
                              <Link href={href} className="block text-sm font-semibold text-foreground hover:underline">
                                {item.name}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            )}
                            <p className="mt-1 text-sm text-muted-foreground">{formatMoney(item.price, locale)}</p>

                            {variantPairs.length > 0 ? (
                              <p className="mt-1 text-xs tracking-wide text-muted-foreground">
                                {variantPairs
                                  .map((pair) => (pair.label ? `${pair.label.toUpperCase()}: ${pair.value}` : pair.value))
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </div>

                          <p className="shrink-0 text-sm font-semibold text-foreground">{formatMoney(total, locale)}</p>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <QuantityStepper
                            quantity={item.quantity}
                            onIncrement={() => increment(item.product_public_id, item.variant_public_id)}
                            onDecrement={() => decrement(item.product_public_id, item.variant_public_id)}
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
                            layout="segmented"
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => removeItem(item.product_public_id, item.variant_public_id)}
                            aria-label={t("remove")}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-border pt-8">
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-baseline gap-4">
                <p className="text-sm font-medium tracking-wide text-muted-foreground">Estimated total</p>
                <p className="text-sm font-semibold text-foreground">{formatMoney(subtotal, locale)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Taxes, discounts and shipping calculated at checkout.</p>

              <Link
                href="/checkout"
                className={cn(
                  buttonVariants({ variant: "primary", size: "md" }),
                  "mt-5 w-full max-w-[22rem] rounded-md md:w-[22rem]",
                )}
              >
                Check out
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

