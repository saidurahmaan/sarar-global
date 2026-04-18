import { NextRequest } from "next/server";

import { checkRateLimit, getClientIp, paperbaseErrorResponse } from "@/lib/server/handler-utils";
import { submitOrderPayment } from "@/lib/server/paperbase";

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

const PHONE_SHAPE = /^[0-9+\-\s]{6,32}$/;

export async function POST(request: NextRequest, context: RouteContext) {
  const ip = getClientIp(request.headers.get("x-forwarded-for"));
  const limited = checkRateLimit(`payment:submit:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }

  const { publicId } = await context.params;
  if (!publicId) {
    return Response.json({ detail: "Missing order id." }, { status: 400 });
  }

  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const transactionId = typeof raw?.transaction_id === "string" ? raw.transaction_id.trim() : "";
    const payerNumber = typeof raw?.payer_number === "string" ? raw.payer_number.trim() : "";

    const fieldErrors: Record<string, string[]> = {};
    if (!transactionId) {
      fieldErrors.transaction_id = ["This field is required."];
    } else if (transactionId.length > 100) {
      fieldErrors.transaction_id = ["Must be 100 characters or fewer."];
    }
    if (!payerNumber) {
      fieldErrors.payer_number = ["This field is required."];
    } else if (payerNumber.length > 32) {
      fieldErrors.payer_number = ["Must be 32 characters or fewer."];
    } else if (!PHONE_SHAPE.test(payerNumber)) {
      fieldErrors.payer_number = ["Enter a valid phone number."];
    }
    if (Object.keys(fieldErrors).length) {
      return Response.json(fieldErrors, { status: 400 });
    }

    const order = await submitOrderPayment(publicId, {
      transaction_id: transactionId,
      payer_number: payerNumber,
    });
    return Response.json(order);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ detail: "Invalid JSON body." }, { status: 400 });
    }
    return paperbaseErrorResponse(error);
  }
}
