"use client";

import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { VariantSelectionProvider, useVariantSelection } from "@/components/product/product-variant-selection";
import { useCart } from "@/hooks/useCart";
import { getProductDetailCached, peekProductDetailCache } from "@/lib/client/product-detail-cache";
import { parseVariantAttributePairs } from "@/lib/variant-details";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/types/cart";
import type { ProductDetail } from "@/types/product";

function VariantSync({
  detail,
  item,
}: {
  detail: ProductDetail;
  item: CartItem;
}) {
  const tCheckout = useTranslations("checkout");
  const tVariant = useTranslations("variantModal");
  const productT = useTranslations("product");
  const { selectedValues, setSelectedValue, selectedVariant, optionsByAttribute } = useVariantSelection();
  const { updateItemVariant } = useCart();

  const allGroupsSelected = Object.keys(selectedValues).length === optionsByAttribute.size;

  useEffect(() => {
    if (!selectedVariant) return;
    if (selectedVariant.public_id === item.variant_public_id) return;
    startTransition(() => {
      updateItemVariant(item.product_public_id, item.variant_public_id, {
        product_public_id: item.product_public_id,
        product_slug: detail.slug,
        variant_public_id: selectedVariant.public_id,
        name: detail.name,
        price: selectedVariant.price,
        image_url: detail.image_url,
        max_quantity: detail.stock_tracking ? selectedVariant.available_quantity : undefined,
        variant_details: selectedVariant.options.map((o) => `${o.attribute_name}: ${o.value}`).join(", "),
      });
    });
  }, [detail, item.product_public_id, item.variant_public_id, selectedVariant, updateItemVariant]);

  return (
    <div className="mt-3 space-y-3">
      {[...optionsByAttribute.entries()].map(([slug, data]) => (
        <div key={slug}>
          <p className="mb-2 text-xs font-bold uppercase tracking-normal text-primary">
            {data.attribute_name}
            {selectedValues[slug] ? (
              <span className="ml-1.5 font-semibold normal-case tracking-normal text-neutral-800">
                : {data.values.find((v) => v.value_public_id === selectedValues[slug])?.value}
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
                    "inline-flex min-h-9 cursor-pointer items-center rounded-md px-3.5 py-2 text-xs font-semibold sm:text-sm",
                    selected
                      ? "bg-neutral-950 text-white shadow-sm"
                      : "border border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400",
                  )}
                >
                  {value.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="min-h-[1.25rem] pt-0.5">
        {!allGroupsSelected ? (
          <p className="text-xs font-medium text-amber-600">{tVariant("selectAllOptions")}</p>
        ) : selectedVariant == null ? (
          <p className="text-xs font-medium text-red-600">{tVariant("unavailableCombination")}</p>
        ) : selectedVariant.stock_status === "out_of_stock" ? (
          <p className="text-xs font-medium text-neutral-500">{productT("outOfStock")}</p>
        ) : detail.stock_tracking ? (
          <p className="text-xs font-medium text-sky-800/90">
            {tCheckout("stockAvailable", { count: selectedVariant.available_quantity })}
          </p>
        ) : (
          <p className="text-xs font-medium text-emerald-700">{tVariant("inStock")}</p>
        )}
      </div>
    </div>
  );
}

function StaticVariantBadges({ item }: { item: CartItem }) {
  const variantPairs = parseVariantAttributePairs(item.variant_details);
  if (variantPairs.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {variantPairs.map((pair, idx) => (
        <div key={`${pair.label}-${pair.value}-${idx}`} className="min-w-0">
          {pair.label ? (
            <p className="text-xs font-bold uppercase tracking-normal text-neutral-500">{pair.label}</p>
          ) : null}
          <span className="mt-1 inline-flex rounded bg-neutral-950 px-2.5 py-1 text-xs font-medium text-white">
            {pair.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CheckoutLineVariants({ item }: { item: CartItem }) {
  const slug = item.product_slug;
  const cachedInitial = slug ? peekProductDetailCache(slug) : null;

  const [detail, setDetail] = useState<ProductDetail | null>(() => cachedInitial);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(slug) && !cachedInitial);

  useEffect(() => {
    if (!slug) {
      startTransition(() => {
        setDetail(null);
        setLoadError(false);
        setLoading(false);
      });
      return;
    }

    const cached = peekProductDetailCache(slug);
    if (cached) {
      startTransition(() => {
        setDetail(cached);
        setLoadError(false);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setLoadError(false);
    });
    getProductDetailCached(slug)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug || loadError) {
    return <StaticVariantBadges item={item} />;
  }

  if (loading) {
    return (
      <div className="mt-3 space-y-3 animate-pulse" aria-busy="true">
        <div className="h-3 w-16 rounded bg-neutral-100" />
        <div className="flex gap-2">
          <div className="h-9 w-14 rounded-md bg-neutral-100" />
          <div className="h-9 w-14 rounded-md bg-neutral-100" />
        </div>
        <div className="h-3 w-40 rounded bg-neutral-100" />
      </div>
    );
  }

  const variants = detail?.variants ?? [];
  if (variants.length === 0 || !detail) {
    return <StaticVariantBadges item={item} />;
  }

  if (!item.variant_public_id) {
    return <StaticVariantBadges item={item} />;
  }

  return (
    <VariantSelectionProvider variants={variants} initialVariantPublicId={item.variant_public_id}>
      <VariantSync detail={detail} item={item} />
    </VariantSelectionProvider>
  );
}
