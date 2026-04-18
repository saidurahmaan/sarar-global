import type { ProductPrepaymentType } from "@/types/product";

export type CartItem = {
  product_public_id: string;
  /** Stable React / UI identity for a cart line; preserved when the variant changes on checkout. */
  line_key?: string;
  /** URL segment for `/products/[slug]`; omitted in older persisted carts */
  product_slug?: string;
  variant_public_id?: string;
  /** When set (stock-tracked lines), quantity cannot exceed this */
  max_quantity?: number;
  quantity: number;
  name: string;
  price: string;
  image_url: string | null;
  variant_details?: string;
  /**
   * Resolved product-level prepayment requirement at the time the item entered the cart.
   * Falls back to "none" when the persisted cart pre-dates this field.
   */
  prepayment_type?: ProductPrepaymentType;
};

/**
 * Key-based map of cart items keyed by `${product_public_id}::${variant_public_id ?? "default"}`.
 * Enables O(1) lookup and merge without array scanning.
 */
export type CartMap = Record<string, CartItem>;
