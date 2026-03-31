import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

/**
 * Fetches all active v2 products ordered by display_order.
 * Returns every category — the UI handles rendering per category.
 */
export const getNv2ActiveProducts = async (
  client: SupabaseClient<Database>
) => {
  const { data, error } = await client
    .from("nv2_learning_products")
    .select(
      "id, category, name, description, slug, icon, meta, total_stages, display_order"
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
};

/**
 * Fetches active products filtered by category.
 * Useful when rendering a category-specific page (e.g. /products?category=language).
 */
export const getNv2ProductsByCategory = async (
  client: SupabaseClient<Database>,
  { category }: { category: string }
) => {
  const { data, error } = await client
    .from("nv2_learning_products")
    .select(
      "id, category, name, description, slug, icon, meta, total_stages, display_order"
    )
    .eq("is_active", true)
    .eq("category", category)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
};

/**
 * Fetches a single active product by slug.
 * Used on the product detail page (/products/:slug).
 */
export const getNv2ProductBySlug = async (
  client: SupabaseClient<Database>,
  { slug }: { slug: string }
) => {
  const { data, error } = await client
    .from("nv2_learning_products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Fetches a single product by id (admin use — ignores is_active).
 */
export const getNv2ProductById = async (
  client: SupabaseClient<Database>,
  { id }: { id: string }
) => {
  const { data, error } = await client
    .from("nv2_learning_products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
};
