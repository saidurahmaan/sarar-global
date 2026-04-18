"use client";

import { ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { VariantSelectionProvider, useVariantSelection } from "@/components/product/product-variant-selection";
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getProductDetailCached } from "@/lib/client/product-detail-cache";
import { formatMoney } from "@/lib/format";
import { resolveStorefrontImageUrl, storefrontImageUnoptimized } from "@/lib/storefront-image";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import type { Product, ProductDetail } from "@/types/product";
import type { Locale } from "@/i18n/routing";

type Props = {
  product: Product;
  productName: string;
  variant?: "default" | "card";
};

// ─── Inner picker — must live inside VariantSelectionProvider ──────────────

type PickerProps = {
  detail: ProductDetail;
  onAdded: () => void;
};

function VariantPicker({ detail, onAdded }: PickerProps) {
  const t = useTranslations("variantModal");
  const productT = useTranslations("product");
  const locale = useLocale() as Locale;
  const { addItem, openCartPanel } = useCart();
  const { selectedValues, setSelectedValue, selectedVariant, optionsByAttribute } =
    useVariantSelection();

  const allGroupsSelected = Object.keys(selectedValues).length === optionsByAttribute.size;
  const outOfStock = selectedVariant?.stock_status === "out_of_stock";
  const isLowStock = selectedVariant?.stock_status === "low_stock";
  const canAdd = allGroupsSelected && selectedVariant != null && !outOfStock;

  function handleAdd() {
    if (!canAdd || !selectedVariant) return;
    addItem(
      {
        product_public_id: detail.public_id,
        product_slug: detail.slug,
        variant_public_id: selectedVariant.public_id,
        name: detail.name,
        price: selectedVariant.price,
        image_url: detail.image_url,
        max_quantity: detail.stock_tracking ? selectedVariant.available_quantity : undefined,
        variant_details: selectedVariant.options
          .map((o) => `${o.attribute_name}: ${o.value}`)
          .join(", "),
        prepayment_type: detail.prepayment_type ?? "none",
      },
      1,
    );
    openCartPanel();
    onAdded();
  }

  const imageSrc = resolveStorefrontImageUrl(detail.image_url);

  return (
    <div className="flex flex-col gap-5">
      {/* Product thumbnail + name */}
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50">
          <Image
            src={imageSrc}
            alt={detail.name}
            fill
            sizes="64px"
            className="object-contain p-1"
            unoptimized={storefrontImageUnoptimized(imageSrc)}
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-light leading-snug text-neutral-900 line-clamp-2">
            {detail.name}
          </p>
          {selectedVariant ? (
            <p className="mt-1 text-sm font-semibold text-primary tabular-nums">
              {formatMoney(selectedVariant.price, locale)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-neutral-400">
              {t("yourPrice")}
            </p>
          )}
        </div>
      </div>

      {/* Variant option groups */}
      <div className="space-y-4">
        {[...optionsByAttribute.entries()].map(([slug, data]) => (
          <div key={slug}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              {data.attribute_name}
              {selectedValues[slug] ? (
                <span className="ml-1.5 font-semibold normal-case tracking-normal text-neutral-800">
                  :{" "}
                  {data.values.find((v) => v.value_public_id === selectedValues[slug])?.value}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.values.map((value) => {
                const selected = selectedValues[slug] === value.value_public_id;
                return (
                  <button
                    key={value.value_public_id}
                    type="button"
                    onClick={() => setSelectedValue(slug, value.value_public_id)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex min-h-9 cursor-pointer items-center rounded-md px-4 py-2 text-sm font-semibold",
                      selected
                        ? "bg-primary text-white shadow-sm"
                        : "border border-neutral-200 bg-white text-neutral-800 hover:border-primary/40 hover:bg-primary/[0.04]",
                    )}
                  >
                    {value.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Validation / stock feedback */}
      <div className="min-h-[1.25rem]">
        {!allGroupsSelected ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <span className="inline-block size-1.5 rounded-full bg-amber-400" />
            {t("selectAllOptions")}
          </p>
        ) : allGroupsSelected && selectedVariant == null ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-red-500">
            <span className="inline-block size-1.5 rounded-full bg-red-400" />
            {t("unavailableCombination")}
          </p>
        ) : outOfStock ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
            <span className="inline-block size-1.5 rounded-full bg-neutral-300" />
            {productT("outOfStock")}
          </p>
        ) : isLowStock && selectedVariant ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
            <span className="inline-block size-1.5 rounded-full bg-amber-400" />
            {t("onlyLeft", { count: selectedVariant.available_quantity })}
          </p>
        ) : canAdd ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <span className="inline-block size-1.5 rounded-full bg-success" />
            {t("inStock")}
          </p>
        ) : null}
      </div>

      {/* Add to Cart button */}
      <button
        type="button"
        disabled={!canAdd}
        onClick={handleAdd}
        className={cn(
          "flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-bold tracking-wide text-white transition-all",
          "bg-primary hover:bg-primary/90 active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <ShoppingCart className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        {outOfStock ? productT("outOfStock") : t("addToCart")}
      </button>
    </div>
  );
}

// ─── Skeleton while loading ────────────────────────────────────────────────

function VariantPickerSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 rounded-lg bg-neutral-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-neutral-100" />
          <div className="h-3 w-1/3 rounded bg-neutral-100" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-1/4 rounded bg-neutral-100" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-16 rounded-md bg-neutral-100" />
          ))}
        </div>
      </div>
      <div className="h-12 rounded-md bg-neutral-100" />
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────

export function ProductCardVariantModal({ product, productName, variant = "default" }: Props) {
  const t = useTranslations("variantModal");
  const productT = useTranslations("product");
  const tCard = useTranslations("productCard");

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loadError, setLoadError] = useState(false);

  const isCard = variant === "card";
  const triggerLabel = isCard ? tCard("addToCart") : productT("addToCart");
  const disabled = product.stock_status === "out_of_stock";

  const fetchDetail = useCallback(async () => {
    setDetail(null);
    setLoadError(false);
    try {
      const data = await getProductDetailCached(product.slug);
      setDetail(data);
    } catch {
      setLoadError(true);
    }
  }, [product.slug]);

  useEffect(() => {
    if (open) {
      fetchDetail();
    }
  }, [open, fetchDetail]);

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full cursor-pointer items-center justify-center text-white transition-colors duration-200 ease-out",
            isCard
              ? "gap-2 rounded-md py-2.5 text-sm font-medium bg-primary hover:bg-primary/90 active:bg-primary/95"
              : "h-8 gap-1 rounded-md text-[11px] font-semibold sm:h-9 sm:gap-1.5 sm:text-[13px] bg-primary hover:bg-primary/90",
            "disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:hover:bg-neutral-300",
          )}
        >
          <ShoppingCart
            className={cn(
              "shrink-0 stroke-[2]",
              isCard ? "size-[18px]" : "size-3.5 sm:size-4 md:size-4",
            )}
            aria-hidden
          />
          <span>{disabled ? productT("outOfStock") : triggerLabel}</span>
        </button>
      </DialogTrigger>

      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {loadError ? (
            <div className="space-y-3 text-center py-4">
              <p className="text-sm text-neutral-600">{t("loadError")}</p>
              <button
                type="button"
                onClick={fetchDetail}
                className="cursor-pointer text-sm font-semibold text-primary underline underline-offset-2"
              >
                {t("retry")}
              </button>
            </div>
          ) : detail == null ? (
            <VariantPickerSkeleton />
          ) : (
            <VariantSelectionProvider variants={detail.variants}>
              <VariantPicker detail={detail} onAdded={() => setOpen(false)} />
            </VariantSelectionProvider>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
