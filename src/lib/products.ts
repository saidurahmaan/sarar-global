import { categoryDisplayName } from "@/lib/category-display";
import {
  combinedSearch,
  getCatalogFilters,
  getCategoryBySlug,
  getProductDetail,
  getRelatedProducts,
  listCategories,
  listProducts,
  searchProducts,
} from "@/lib/server/paperbase";
import type { Product, ProductDetail } from "@/types/product";
import type {
  PaperbaseCategoryTreeNode,
  PaperbaseProductDetail,
  PaperbaseProductListItem,
} from "@/types/paperbase";

function mapProduct(item: PaperbaseProductListItem): Product {
  return {
    public_id: item.public_id,
    name: item.name,
    slug: item.slug,
    image_url: item.image_url,
    price: item.price,
    original_price: item.original_price,
    stock_status: item.stock_status,
    available_quantity: item.available_quantity,
    variant_count: item.variant_count,
    brand: item.brand,
    category_public_id: item.category_public_id,
    category_slug: item.category_slug,
    category_name: item.category_name,
    extra_data: item.extra_data ?? {},
    prepayment_type: item.prepayment_type ?? "none",
  };
}

function mapProductDetail(item: PaperbaseProductDetail): ProductDetail {
  return {
    public_id: item.public_id,
    name: item.name,
    slug: item.slug,
    image_url: item.image_url,
    price: item.price,
    original_price: item.original_price,
    stock_status: item.stock_status,
    available_quantity: item.available_quantity,
    brand: item.brand,
    category_public_id: item.category_public_id,
    category_slug: item.category_slug,
    category_name: item.category_name,
    extra_data: item.extra_data ?? {},
    stock_tracking: item.stock_tracking,
    description: item.description,
    images: item.images ?? [],
    variants: item.variants ?? [],
    prepayment_type: item.prepayment_type ?? "none",
  };
}

export async function getProductsForceCache(page = 1): Promise<Product[]> {
  const response = await listProducts({ page });
  return response.results.map(mapProduct);
}

export async function getProductsRevalidated(page = 1): Promise<Product[]> {
  const response = await listProducts({ page });
  return response.results.map(mapProduct);
}

export async function getProductsNoStore(page = 1): Promise<Product[]> {
  const response = await listProducts({ page });
  return response.results.map(mapProduct);
}

export async function getStorefrontProducts(page = 1): Promise<Product[]> {
  return getProductsRevalidated(page);
}

const HOME_CATEGORY_PRODUCT_LIMIT = 10;

export type StorefrontHomeCategorySection = {
  name: string;
  slug: string;
  description: string;
  products: Product[];
  showViewMore: boolean;
};

/** Root storefront categories with up to eight products each (for the home page). */
export async function getStorefrontHomeCategorySections(): Promise<StorefrontHomeCategorySection[]> {
  const roots = (await listCategories({ tree: "1" })) as PaperbaseCategoryTreeNode[];
  const sections = await Promise.all(
    roots.map(async (cat) => {
      const response = await listProducts({ category: cat.slug, page: 1 });
      const products = response.results.slice(0, HOME_CATEGORY_PRODUCT_LIMIT).map(mapProduct);
      const showViewMore =
        response.count > HOME_CATEGORY_PRODUCT_LIMIT ||
        response.results.length > HOME_CATEGORY_PRODUCT_LIMIT;
      return {
        name: categoryDisplayName(cat.name),
        slug: cat.slug,
        description: typeof cat.description === "string" ? cat.description.trim() : "",
        products,
        showViewMore,
      };
    }),
  );
  return sections.filter((section) => section.products.length > 0);
}

export async function getStorefrontProductDetail(identifier: string): Promise<ProductDetail | undefined> {
  try {
    const response = await getProductDetail(identifier);
    return mapProductDetail(response);
  } catch {
    return undefined;
  }
}

export async function getStorefrontProductSlugs(): Promise<string[]> {
  const firstPage = await listProducts({ page: 1 });
  return firstPage.results.map((product) => product.slug);
}

export async function getStorefrontRelatedProducts(identifier: string): Promise<Product[]> {
  const response = await getRelatedProducts(identifier);
  return response.map(mapProduct);
}

export async function getStorefrontSearchProducts(q: string, page = 1): Promise<Product[]> {
  const response = await searchProducts(q, page);
  return response.results.map(mapProduct);
}

/**
 * Full search UX: paginated products plus combined metadata (`GET /search/`).
 * Combined response supplies matching categories and name suggestions (capped by API).
 */
export async function getStorefrontSearchResults(q: string, page = 1) {
  const query = q.trim();
  const [paginated, combined] = await Promise.all([
    searchProducts(query, page),
    combinedSearch({ q: query }),
  ]);
  return {
    count: paginated.count,
    next: paginated.next,
    previous: paginated.previous,
    products: paginated.results.map(mapProduct),
    categories: combined.categories,
    suggestions: combined.suggestions,
  };
}

export async function getStorefrontCombinedSearch(q: string) {
  return combinedSearch({ q });
}

export async function getStorefrontCategoriesTree() {
  const response = await listCategories({ tree: "1" });
  return response;
}

export async function getStorefrontCategoryBySlug(slug: string) {
  return getCategoryBySlug(slug);
}

export async function getStorefrontCatalogFilters() {
  return getCatalogFilters();
}
