import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

/**
 * Creates or updates a user's product subscription.
 * Note: The Supabase client requires keys to match the database column names (snake_case).
 */
export const createSubscription = async (
  client: SupabaseClient<Database>,
  { 
    userId, 
    productId, 
    snsConnectionId, 
    tier 
  }: { 
    userId: string; 
    productId: string; 
    snsConnectionId: string; 
    tier: "basic" | "premium" | "vip" 
  }
) => {
  const { data, error } = await client
    .from("user_product_subscription")
    .upsert({
      user_id: userId, // Corrected: use snake_case as defined in the DB schema
      learning_product_id: productId, // Corrected
      user_sns_connection_id: snsConnectionId, // Corrected
      subscription_tier: tier, // Corrected
      is_active: true, // Corrected
      push_enabled: true, // Corrected
      subscribed_at: new Date().toISOString(), // Corrected
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};