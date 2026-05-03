"use client";

import { Heart, ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { memo, useCallback, useEffect, useState } from "react";

import { VariantSelectionProvider, useVariantSelection } from "@/components/product/product-variant-selection";
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getProductDetailCached, peekProductDetailCache } from "@/lib/client/product-detail-cache";
import { formatMoney } from "@/lib/format";
import { resolveStorefrontImageUrl, storefrontImageUnoptimized } from "@/lib/storefront-image";
import { triggerAddToCart } from "@/lib/tracker";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useAddToCartDialogStore } from "@/lib/store/add-to-cart-dialog-store";
import type { Product, ProductDetail } from "@/types/product";
import type { Locale } from "@/i18n/routing";

type Props = {
  product: Product;
  variant?: "default" | "card" | "icon";
};

// ─── Inner picker — must live inside VariantSelectionProvider ──────────────

type PickerProps = {
  detail: ProductDetail;
  onAdded: () => void;
};

const VariantPicker = memo(function VariantPicker({ detail, onAdded }: PickerProps) {
  const t = useTranslations("variantModal");
  const tDetail = useTranslations("productDetail");
  const productT = useTranslations("product");
  const locale = useLocale() as Locale;
  const { addItem } = useCart();
  const openAddToCartDialog = useAddToCartDialogStore((s) => s.openDialog);
  const { selectedValues, setSelectedValue, selectedVariant, optionsByAttribute } =
    useVariantSelection();

  const allGroupsSelected = Object.keys(selectedValues).length === optionsByAttribute.size;
  const outOfStock = selectedVariant?.stock_status === "out_of_stock";
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
    triggerAddToCart({
      id: detail.public_id,
      value: Number(selectedVariant.price),
    });
    onAdded();
    openAddToCartDialog({
      name: detail.name,
      image_url: detail.image_url,
      variant_details: selectedVariant.options.map((o) => `${o.attribute_name}: ${o.value}`).join(", "),
    });
  }

  const imageSrc = resolveStorefrontImageUrl(detail.image_url);

  return (
    <div className="flex flex-col gap-5">
      {/* Product thumbnail + name */}
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
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
          <p className="text-sm font-light leading-snug text-foreground line-clamp-2">
            {detail.name}
          </p>
          {selectedVariant ? (
            <p className="mt-1 text-sm font-semibold text-primary tabular-nums">
              {formatMoney(selectedVariant.price, locale)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("yourPrice")}
            </p>
          )}
        </div>
      </div>

      {/* Variant option groups */}
      <div className="space-y-4">
        {[...optionsByAttribute.entries()].map(([slug, data]) => (
          <div key={slug}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {data.attribute_name}
              {selectedValues[slug] ? (
                <span className="ml-1.5 font-semibold normal-case tracking-normal text-foreground">
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
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/[0.04]",
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
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-muted-foreground" />
            {productT("outOfStock")}
          </p>
        ) : canAdd && selectedVariant ? (
          detail.stock_tracking &&
          selectedVariant.available_quantity != null &&
          selectedVariant.available_quantity > 0 ? (
            selectedVariant.available_quantity < 10 ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                <span className="inline-block size-1.5 rounded-full bg-red-500" />
                {tDetail("stockMessageLow")}
              </p>
            ) : selectedVariant.available_quantity <= 50 ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-yellow-700">
                <span className="inline-block size-1.5 rounded-full bg-yellow-500" />
                {tDetail("stockMessageSellingOut")}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <span className="inline-block size-1.5 rounded-full bg-success" />
                {tDetail("stockMessageAvailable")}
              </p>
            )
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
              <span className="inline-block size-1.5 rounded-full bg-success" />
              {tDetail("stockMessageAvailable")}
            </p>
          )
        ) : null}
      </div>

      {/* Add to Cart button */}
      <button
        type="button"
        disabled={!canAdd}
        onClick={handleAdd}
        className={cn(
          "flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-bold tracking-wide text-primary-foreground transition-all",
          "bg-primary hover:bg-primary/90 active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <ShoppingCart className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        {outOfStock ? productT("outOfStock") : t("addToCart")}
      </button>
    </div>
  );
});

// ─── Skeleton while loading ────────────────────────────────────────────────

function VariantPickerSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-1/4 rounded bg-muted" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-16 rounded-md bg-muted" />
          ))}
        </div>
      </div>
      <div className="h-12 rounded-md bg-muted" />
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────

export function ProductCardVariantModal({ product, variant = "default" }: Props) {
  const t = useTranslations("variantModal");
  const productT = useTranslations("product");
  const tCard = useTranslations("productCard");

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loadError, setLoadError] = useState(false);

  const isCard = variant === "card";
  const isIcon = variant === "icon";
  const triggerLabel = isCard ? tCard("addToCart") : productT("addToCart");
  const disabled = product.stock_status === "out_of_stock";
  const prefetchDetail = useCallback(() => {
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      return;
    }
    void getProductDetailCached(product.slug);
  }, [product]);

  const fetchDetail = useCallback(async () => {
    setLoadError(false);
    try {
      if (Array.isArray(product.variants) && product.variants.length > 0) {
        setDetail({
          public_id: product.public_id,
          name: product.name,
          slug: product.slug,
          image_url: product.image_url,
          price: product.price,
          original_price: product.original_price,
          stock_status: product.stock_status,
          available_quantity: product.available_quantity,
          brand: product.brand,
          category_public_id: product.category_public_id,
          category_slug: product.category_slug,
          category_name: product.category_name,
          extra_data: product.extra_data,
          prepayment_type: product.prepayment_type,
          stock_tracking: true,
          description: "",
          images: [],
          variants: product.variants,
          related_products: [],
        });
        return;
      }
      const seeded = peekProductDetailCache(product.slug);
      if (seeded) {
        setDetail(seeded);
        return;
      }
      const data = await getProductDetailCached(product.slug);
      setDetail(data);
    } catch {
      setLoadError(true);
    }
  }, [product]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (Array.isArray(product.variants) && product.variants.length > 0) {
        setDetail({
          public_id: product.public_id,
          name: product.name,
          slug: product.slug,
          image_url: product.image_url,
          price: product.price,
          original_price: product.original_price,
          stock_status: product.stock_status,
          available_quantity: product.available_quantity,
          brand: product.brand,
          category_public_id: product.category_public_id,
          category_slug: product.category_slug,
          category_name: product.category_name,
          extra_data: product.extra_data,
          prepayment_type: product.prepayment_type,
          stock_tracking: true,
          description: "",
          images: [],
          variants: product.variants,
          related_products: [],
        });
        return;
      }
      const seeded = peekProductDetailCache(product.slug);
      if (seeded) {
        setDetail(seeded);
        return;
      }
      void fetchDetail();
    });
  }, [open, fetchDetail, product]);

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onMouseEnter={prefetchDetail}
          onTouchStart={prefetchDetail}
          aria-label={disabled ? productT("outOfStock") : triggerLabel}
          className={cn(
            "flex cursor-pointer items-center justify-center transition-colors duration-200 ease-out",
            isIcon
              ? "size-9 rounded-full bg-background text-foreground shadow-sm ring-1 ring-foreground/10 hover:bg-background/95 hover:ring-foreground/15"
              : "w-full text-primary-foreground",
            isCard
              ? "gap-2 rounded-md py-2.5 text-sm font-medium bg-primary hover:bg-primary/90 active:bg-primary/95"
              : isIcon
                ? ""
                : "h-8 gap-1 rounded-md text-[11px] font-semibold sm:h-9 sm:gap-1.5 sm:text-[13px] bg-primary hover:bg-primary/90",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted",
            isIcon && "disabled:bg-muted disabled:text-muted-foreground",
          )}
        >
          {isIcon ? (
            <Heart className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
          ) : (
            <ShoppingCart
              className={cn(
                "shrink-0 stroke-[2]",
                isCard ? "size-[18px]" : "size-3.5 sm:size-4 md:size-4",
              )}
              aria-hidden
            />
          )}
          {isIcon ? <span className="sr-only">{disabled ? productT("outOfStock") : triggerLabel}</span> : <span>{disabled ? productT("outOfStock") : triggerLabel}</span>}
        </button>
      </DialogTrigger>

      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {loadError ? (
            <div className="space-y-3 text-center py-4">
              <p className="text-sm text-muted-foreground">{t("loadError")}</p>
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
