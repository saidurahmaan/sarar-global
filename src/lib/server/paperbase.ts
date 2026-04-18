import "server-only";

import { cache } from "react";

import { getServerPaperbaseConfig } from "@/lib/server/config";
import { PaperbaseApiError } from "@/lib/api/paperbase-errors";
import type {
  PaginatedResponse,
  PaperbaseBanner,
  PaperbaseBannerSlot,
  PaperbaseCatalogFilters,
  PaperbaseCategory,
  PaperbaseCategoryTreeNode,
  PaperbaseCombinedSearchResponse,
  PaperbaseNotification,
  PaperbaseOrderCreateRequest,
  PaperbaseOrderCreateResponse,
  PaperbaseOrderReceipt,
  PaperbasePaymentSubmitRequest,
  PaperbasePricingBreakdownRequest,
  PaperbasePricingBreakdownResponse,
  PaperbasePricingPreviewRequest,
  PaperbaseProductDetail,
  PaperbaseProductListItem,
  PaperbaseShippingOption,
  PaperbaseShippingPreviewRequest,
  PaperbaseShippingPreviewResponse,
  PaperbaseShippingZone,
  PaperbaseStorePublic,
  PaperbaseSupportTicketRequest,
  PaperbaseSupportTicketResponse,
} from "@/types/paperbase";

type Primitive = string | number | boolean;
type QueryParams = Record<string, Primitive | null | undefined>;

type RequestOptions = {
  query?: QueryParams;
  body?: unknown;
  formData?: FormData;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

function toQueryString(query: QueryParams | undefined): string {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function requestOnce<T>(
  method: "GET" | "POST",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { baseUrl, publishableKey } = getServerPaperbaseConfig();
  const url = `${baseUrl}${path}${toQueryString(options.query)}`;

  const headers: HeadersInit = {
    Authorization: `Bearer ${publishableKey}`,
  };

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    cache: options.cache,
    next: options.next,
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new PaperbaseApiError("Paperbase API request failed", response.status, payload);
  }

  return (await response.json()) as T;
}

/** Bounded retry for idempotent GETs (transient failures). */
async function requestGetWithRetry<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await requestOnce<T>("GET", path, options);
  } catch (error) {
    if (error instanceof PaperbaseApiError && (error.status === 429 || error.status >= 500)) {
      return requestOnce<T>("GET", path, options);
    }
    throw error;
  }
}

export function paperbaseGet<T>(
  path: string,
  options?: Omit<RequestOptions, "body" | "formData">,
): Promise<T> {
  return requestGetWithRetry<T>(path, options);
}

export function paperbasePost<T>(
  path: string,
  options?: Omit<RequestOptions, "query">,
): Promise<T> {
  return requestOnce<T>("POST", path, options);
}

/** Per-request deduped: layout + Navbar + Footer all resolve to a single backend fetch. */
export const getStorePublic = cache(() =>
  paperbaseGet<PaperbaseStorePublic>("store/public/", {
    next: { revalidate: 300 },
  }),
);

export function listProducts(query?: {
  page?: number;
  category?: string;
  brand?: string;
  search?: string;
  price_min?: string;
  price_max?: string;
  attributes?: string;
  ordering?: "newest" | "price_asc" | "price_desc" | "popularity";
  sort?: "newest" | "price_asc" | "price_desc" | "popularity";
}) {
  return paperbaseGet<PaginatedResponse<PaperbaseProductListItem>>("products/", {
    query,
    next: { revalidate: 60 },
  });
}

export function getProductDetail(identifier: string) {
  return paperbaseGet<PaperbaseProductDetail>(`products/${identifier}/`, {
    next: { revalidate: 60 },
  });
}

export function getRelatedProducts(identifier: string) {
  return paperbaseGet<PaperbaseProductListItem[]>(`products/${identifier}/related/`, {
    next: { revalidate: 60 },
  });
}

export function searchProducts(q: string, page?: number) {
  return paperbaseGet<PaginatedResponse<PaperbaseProductListItem>>("products/search/", {
    query: { q, page },
  });
}

/** Per-request deduped tree fetch (Navbar + pages all share one call). */
const getCategoryTreeCached = cache(() =>
  paperbaseGet<PaperbaseCategoryTreeNode[]>("categories/", {
    query: { tree: "1" },
    next: { revalidate: 120 },
  }),
);

export function listCategories(query: {
  page?: number;
  tree: "1" | "true" | "yes";
}): Promise<PaperbaseCategoryTreeNode[]>;
export function listCategories(query?: {
  page?: number;
  tree?: undefined;
}): Promise<PaginatedResponse<PaperbaseCategory>>;
export function listCategories(query?: {
  page?: number;
  tree?: "1" | "true" | "yes";
}): Promise<PaperbaseCategoryTreeNode[] | PaginatedResponse<PaperbaseCategory>> {
  const tree = query?.tree;
  if (tree) {
    return getCategoryTreeCached();
  }
  return paperbaseGet<PaginatedResponse<PaperbaseCategory>>("categories/", {
    query,
    next: { revalidate: 120 },
  });
}

export function getCategoryBySlug(slug: string) {
  return paperbaseGet<PaperbaseCategory>(`categories/${slug}/`);
}

export function getCatalogFilters() {
  return paperbaseGet<PaperbaseCatalogFilters>("catalog/filters/", {
    next: { revalidate: 120 },
  });
}

export const getBanners = cache((slot?: PaperbaseBannerSlot) =>
  paperbaseGet<PaperbaseBanner[]>("banners/", {
    query: { slot },
    next: { revalidate: 120 },
  }),
);

export const getActiveNotifications = cache(() =>
  paperbaseGet<PaperbaseNotification[]>("notifications/active/", {
    next: { revalidate: 120 },
  }),
);

export function getShippingZones() {
  return paperbaseGet<PaperbaseShippingZone[]>("shipping/zones/");
}

export function getShippingOptions(zone_public_id: string, order_total?: string) {
  return paperbaseGet<PaperbaseShippingOption[]>("shipping/options/", {
    query: { zone_public_id, order_total },
  });
}

export function previewShipping(body: PaperbaseShippingPreviewRequest) {
  return paperbasePost<PaperbaseShippingPreviewResponse>("shipping/preview/", { body });
}

export function createOrder(body: PaperbaseOrderCreateRequest) {
  return paperbasePost<PaperbaseOrderCreateResponse>("orders/", { body });
}

export function submitOrderPayment(
  public_id: string,
  body: PaperbasePaymentSubmitRequest,
) {
  return paperbasePost<PaperbaseOrderReceipt>(`orders/${public_id}/payment/`, {
    body,
  });
}

export function pricingPreview(body: PaperbasePricingPreviewRequest) {
  return paperbasePost<PaperbasePricingBreakdownResponse>("pricing/preview/", { body });
}

export function pricingBreakdown(body: PaperbasePricingBreakdownRequest) {
  return paperbasePost<PaperbasePricingBreakdownResponse>("pricing/breakdown/", { body });
}

export function combinedSearch(query?: { q?: string; trending?: "1" | "true" | "yes" }) {
  return paperbaseGet<PaperbaseCombinedSearchResponse>("search/", { query });
}

export function createSupportTicketJson(body: PaperbaseSupportTicketRequest) {
  return paperbasePost<PaperbaseSupportTicketResponse>("support/tickets/", { body });
}

export function createSupportTicketMultipart(formData: FormData) {
  return paperbasePost<PaperbaseSupportTicketResponse>("support/tickets/", { formData });
}
