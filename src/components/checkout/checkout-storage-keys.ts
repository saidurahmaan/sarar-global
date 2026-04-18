/**
 * sessionStorage key for the shipping-step checkout draft consumed by the payment step.
 */
export const CHECKOUT_DRAFT_STORAGE_KEY = "paperbase-checkout-draft";

/**
 * sessionStorage key for the resolved prepayment type for the pending order.
 * Value is one of `ProductPrepaymentType` ("none" | "delivery_only" | "full").
 *
 * Captured at shipping-submit time so the payment step reflects the actual items
 * being ordered even after the Buy Now session map is cleared.
 */
export const CHECKOUT_PREPAYMENT_STORAGE_KEY = "paperbase-checkout-prepayment";
