export type PaperbaseStockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type PaperbaseOrderStatus = "pending" | "payment_pending" | "confirmed" | "cancelled";
export type PaperbasePaymentStatus = "none" | "submitted" | "verified" | "failed";
export type PaperbasePrepaymentType = "none" | "delivery_only" | "full";

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type PaperbaseStorePublic = {
  store_name: string;
  logo_url: string | null;
  currency: string;
  currency_symbol: string;
  country: string;
  support_email: string;
  phone: string;
  address: string;
  tracker_build_id?: string;
  tracker_script_src?: string;
  extra_field_schema: Array<{
    id: string;
    entityType: string;
    name: string;
    fieldType: string;
    required: boolean;
    order: number;
    options: string[];
  }>;
  modules_enabled: {
    products: boolean;
    orders: boolean;
    customers: boolean;
  };
  theme_settings: {
    primary_color: string;
  };
  seo: {
    default_title: string;
    default_description: string;
  };
  policy_urls: {
    returns: string;
    refund: string;
    privacy: string;
  };
  social_links: {
    facebook: string;
    instagram: string;
    twitter: string;
    youtube: string;
    linkedin: string;
    tiktok: string;
    pinterest: string;
    website: string;
  };
};

export type PaperbaseProductListItem = {
  public_id: string;
  name: string;
  brand: string | null;
  price: string;
  original_price: string | null;
  image_url: string | null;
  category_public_id: string;
  category_slug: string;
  category_name: string;
  slug: string;
  stock_status: PaperbaseStockStatus;
  available_quantity: number;
  variant_count: number;
  extra_data: Record<string, unknown>;
  prepayment_type?: PaperbasePrepaymentType;
};

export type PaperbaseProductImage = {
  public_id: string;
  image_url: string | null;
  alt: string;
  order: number;
};

export type PaperbaseVariantOption = {
  attribute_public_id: string;
  attribute_slug: string;
  attribute_name: string;
  value_public_id: string;
  value: string;
};

export type PaperbaseProductVariant = {
  public_id: string;
  sku: string;
  available_quantity: number;
  stock_status: PaperbaseStockStatus;
  price: string;
  options: PaperbaseVariantOption[];
};

export type PaperbaseProductDetail = {
  public_id: string;
  name: string;
  brand: string | null;
  stock_tracking: boolean;
  slug: string;
  price: string;
  original_price: string | null;
  image_url: string | null;
  images: PaperbaseProductImage[];
  category_public_id: string;
  category_slug: string;
  category_name: string;
  description: string;
  stock_status: PaperbaseStockStatus;
  available_quantity: number;
  variants: PaperbaseProductVariant[];
  extra_data: Record<string, unknown>;
  prepayment_type?: PaperbasePrepaymentType;
};

export type PaperbaseCategory = {
  public_id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  parent_public_id: string | null;
  order: number;
};

export type PaperbaseCategoryTreeNode = PaperbaseCategory & {
  children: PaperbaseCategoryTreeNode[];
};

export type PaperbaseCatalogFilters = {
  categories: Array<{ public_id: string; name: string; slug: string }>;
  attributes: Record<string, Array<{ public_id: string; value: string }>>;
  brands: string[];
  price_range: {
    min: number;
    max: number;
  };
};

export type PaperbaseBannerSlot = "home_top" | "home_mid" | "home_bottom";

export type PaperbaseBanner = {
  public_id: string;
  title: string;
  image_url: string | null;
  cta_text: string;
  cta_url: string;
  order: number;
  placement_slots: PaperbaseBannerSlot[];
  start_at: string | null;
  end_at: string | null;
};

export type PaperbaseNotification = {
  public_id: string;
  cta_text: string;
  notification_type: "banner" | "alert" | "promo";
  cta_url: string | null;
  cta_label: string;
  order: number;
  is_active: boolean;
  is_currently_active: boolean;
  start_at: string | null;
  end_at: string | null;
};

export type PaperbaseShippingZone = {
  zone_public_id: string;
  name: string;
  estimated_days: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  cost_rules: Array<{
    min_order_total: number;
    max_order_total?: number;
    shipping_cost: number;
  }>;
};

export type PaperbaseShippingOption = {
  rate_public_id: string;
  method_public_id: string;
  method_name: string;
  method_type: "standard" | "express" | "pickup" | "other";
  method_order: number;
  zone_public_id: string;
  zone_name: string;
  price: string;
  rate_type: "flat" | "weight" | "order_total";
  min_order_total: string | null;
  max_order_total: string | null;
};

export type PaperbaseCheckoutItemInput = {
  product_public_id: string;
  variant_public_id?: string;
  quantity: number;
};

export type PaperbaseShippingPreviewRequest = {
  zone_public_id: string;
  items: PaperbaseCheckoutItemInput[];
};

export type PaperbaseShippingPreviewResponse = {
  shipping_cost: string;
  estimated_days: string;
  currency: string;
};

export type PaperbasePricingBreakdownRequest = {
  items: PaperbaseCheckoutItemInput[];
  shipping_zone_public_id?: string;
  shipping_method_public_id?: string;
};

export type PaperbasePricingPreviewRequest = {
  product_public_id: string;
  variant_public_id?: string;
  quantity?: number;
  shipping_zone_public_id?: string;
  shipping_method_public_id?: string;
};

export type PaperbasePricingBreakdownResponse = {
  base_subtotal: string;
  shipping_cost: string;
  final_total: string;
  lines: Array<{
    product_public_id: string;
    quantity: number;
    unit_price: string;
    line_subtotal: string;
  }>;
};

export type PaperbaseOrderCreateRequest = {
  shipping_zone_public_id: string;
  shipping_method_public_id?: string;
  shipping_name: string;
  phone: string;
  email?: string;
  shipping_address: string;
  district?: string;
  products: Array<{
    product_public_id: string;
    quantity: number;
    variant_public_id?: string;
  }>;
};

export type PaperbaseOrderCreateResponse = {
  public_id: string;
  order_number: string;
  status: PaperbaseOrderStatus;
  customer_name: string;
  phone: string;
  shipping_address: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: string;
    total_price: string;
    variant_details: string | null;
  }>;
  subtotal: string;
  shipping_cost: string;
  total: string;
  payment_status?: PaperbasePaymentStatus;
  prepayment_type?: PaperbasePrepaymentType;
  requires_payment?: boolean;
  transaction_id?: string | null;
  payer_number?: string | null;
};

export type PaperbaseOrderReceipt = PaperbaseOrderCreateResponse;

export type PaperbasePaymentSubmitRequest = {
  transaction_id: string;
  payer_number: string;
};

export type PaperbaseCombinedSearchResponse = {
  products: PaperbaseProductListItem[];
  categories: PaperbaseCategory[];
  suggestions: string[];
  trending: boolean;
};

export type PaperbaseSupportTicketRequest = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  order_number?: string;
  category?: "general" | "order" | "payment" | "shipping" | "product" | "technical" | "other";
  priority?: "low" | "medium" | "high" | "urgent";
};

export type PaperbaseSupportTicketResponse = {
  public_id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  order_number: string;
  category: string;
  priority: string;
  status: "new";
  created_at: string;
  updated_at: string;
};
