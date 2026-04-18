export type ProductPrepaymentType = "none" | "delivery_only" | "full";

export type Product = {
  public_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  price: string;
  original_price: string | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  available_quantity: number;
  variant_count: number;
  brand: string | null;
  category_public_id: string;
  category_slug: string;
  category_name: string;
  extra_data: Record<string, unknown>;
  prepayment_type?: ProductPrepaymentType;
};

export type ProductVariantOption = {
  attribute_public_id: string;
  attribute_slug: string;
  attribute_name: string;
  value_public_id: string;
  value: string;
};

export type ProductVariant = {
  public_id: string;
  sku: string;
  available_quantity: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  price: string;
  options: ProductVariantOption[];
};

export type ProductImage = {
  public_id: string;
  image_url: string | null;
  alt: string;
  order: number;
};

export type ProductDetail = Omit<Product, "variant_count"> & {
  stock_tracking: boolean;
  description: string;
  images: ProductImage[];
  variants: ProductVariant[];
};
