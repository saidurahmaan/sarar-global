import { NextRequest } from "next/server";

import { checkRateLimit, getClientIp, paperbaseErrorResponse } from "@/lib/server/handler-utils";
import { createOrder } from "@/lib/server/paperbase";
import type { PaperbaseOrderCreateRequest } from "@/types/paperbase";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers.get("x-forwarded-for"));
  const limited = checkRateLimit(`checkout:order:${ip}`, 30, 60_000);
  if (!limited.ok) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }

  try {
    const body = (await request.json()) as PaperbaseOrderCreateRequest & {
      payment_method?: "cod" | "mfs";
    };
    console.info("[checkout/order]", { ip });
    const { payment_method: _paymentMethod, ...orderPayload } = body;
    if (
      _paymentMethod != null &&
      _paymentMethod !== "cod" &&
      _paymentMethod !== "mfs"
    ) {
      return Response.json({ detail: "Invalid payment method." }, { status: 400 });
    }
    if (!orderPayload?.shipping_zone_public_id || !orderPayload.shipping_name || !orderPayload.phone || !orderPayload.shipping_address) {
      return Response.json({ detail: "Missing required order fields." }, { status: 400 });
    }
    if (!orderPayload.products || !Array.isArray(orderPayload.products) || orderPayload.products.length === 0) {
      return Response.json({ detail: "No products provided." }, { status: 400 });
    }
    const order = await createOrder(orderPayload);
    return Response.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ detail: "Invalid JSON body." }, { status: 400 });
    }
    return paperbaseErrorResponse(error);
  }
}
