"use client";

import { useEffect, useState } from "react";

import { readStoredOrder } from "@/components/orders/order-storage-keys";
import { useRouter } from "@/i18n/routing";
import { isReceiptEligibleForSuccessPage, isValidOrderPublicId } from "@/lib/checkout/order-success-eligibility";
import { readCheckoutSuccessMeta } from "@/lib/checkout/order-success-meta";
import type { PaperbaseOrderCreateResponse } from "@/types/paperbase";

import { CheckoutOrderSuccess } from "./checkout-order-success";

type SuccessModel = {
  order: PaperbaseOrderCreateResponse;
  paymentMethod: "cod" | "mfs";
  mfsProvider: "bkash" | "nagad" | null;
};

type Props = {
  orderId: string;
};

export function CheckoutSuccessPageClient({ orderId }: Props) {
  const router = useRouter();
  const [model, setModel] = useState<SuccessModel | undefined>(undefined);

  useEffect(() => {
    if (!isValidOrderPublicId(orderId)) {
      router.replace("/");
      return;
    }
    const order = readStoredOrder(orderId);
    if (!isReceiptEligibleForSuccessPage(orderId, order)) {
      router.replace("/");
      return;
    }
    const meta = readCheckoutSuccessMeta(orderId);
    const paymentMethod =
      meta?.payment_method ?? (order.requires_payment === true ? "mfs" : "cod");
    const mfsProvider = meta?.mfs_provider ?? null;
    queueMicrotask(() => {
      setModel({ order, paymentMethod, mfsProvider });
    });
  }, [orderId, router]);

  if (model === undefined) {
    return (
      <div className="bg-card pb-12 pt-6 md:pb-16 md:pt-8">
        <div className="mx-auto max-w-xl px-4 md:px-6">
          <div className="mx-auto h-64 max-w-xs animate-pulse rounded-lg bg-muted" />
          <div className="mx-auto mt-8 h-8 max-w-sm animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card pb-12 pt-6 md:pb-16 md:pt-8">
      <div className="mx-auto max-w-xl px-4 pb-10 pt-2 md:px-6">
        <CheckoutOrderSuccess
          order={model.order}
          paymentMethod={model.paymentMethod}
          mfsProvider={model.mfsProvider}
        />
      </div>
    </div>
  );
}
