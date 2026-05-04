import { getTranslations } from "next-intl/server";

import {
  getActiveNotifications,
  getBanners,
  getStorePublic,
  listCategories,
} from "@/lib/server/paperbase";
import { categoryDisplayName } from "@/lib/category-display";
import { DOCUMENT_METADATA_LOCALE } from "@/lib/document-metadata-locale";
import type { PaperbaseBannerSlot, PaperbaseCategoryTreeNode } from "@/types/paperbase";

export type HeaderCategoryNav = {
  id: string;
  label: string;
  href: string;
  description?: string;
  isNew?: boolean;
  children?: HeaderCategoryNav[];
};

function mapCategoryNode(node: PaperbaseCategoryTreeNode): HeaderCategoryNav {
  return {
    id: node.public_id,
    label: categoryDisplayName(node.name),
    href: `/categories/${node.slug}`,
    description: node.description || undefined,
    children: node.children?.map(mapCategoryNode) ?? [],
  };
}

export async function getStorefrontStorePublic() {
  return getStorePublic();
}

/** Store name for `<title>` suffixes; falls back to English metadata string if API name is empty. */
export async function resolveStorefrontDocumentBrand(): Promise<string> {
  const store = await getStorePublic();
  const name = store.store_name?.trim();
  if (name) return name;
  const t = await getTranslations({ locale: DOCUMENT_METADATA_LOCALE, namespace: "metadata" });
  return t("fallbackStoreName");
}

export async function getStorefrontHeaderCategories() {
  const categories = await listCategories({ tree: "1" });
  return categories.map(mapCategoryNode);
}

export async function getStorefrontBanners(slot?: PaperbaseBannerSlot) {
  const banners = await getBanners(slot);
  return [...banners].sort((a, b) => a.order - b.order);
}

export async function getStorefrontNotifications() {
  const notifications = await getActiveNotifications();
  return notifications
    .filter((item) => item.is_currently_active)
    .sort((a, b) => a.order - b.order);
}
