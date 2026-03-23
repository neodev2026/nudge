/**
 * [Lite Success Page]
 * Finalizing onboarding by sending a Welcome DM via Discord.
 * This replaces the need for n8n workflows for user welcome.
 */
import type { Route } from "./+types/sns-conn-success-page";
import { useLoaderData, Link } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import { 
  upsertLiteProfile, 
  initializeLiteProgress, 
  getLiteProductContents,
  getLiteProductDetail,
  getLiteProgress,
  getFirstCardOfContent,
  updateProgressLastCard
} from "../queries";
import {
  send_discord_message,
  send_card_nudge
 } from "../lib/discord.server";

/**
 * Loader: The final step of the onboarding pipeline.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const sns_id = url.searchParams.get("sns_id");
  const product_id = url.searchParams.get("product_id");
  const sns_type = "discord";

  if (!sns_id || !product_id) {
    throw new Error("Required parameters missing");
  }

  const [client] = makeServerClient(request);
  await upsertLiteProfile(client, { sns_type, sns_id });

  // 1. Check for existing progress to ensure Idempotency
  const existing_progress = await getLiteProgress(client, { 
    sns_type, sns_id, learning_product_id: product_id 
  });

  const product = await getLiteProductDetail(client, product_id);
  let is_new_user = false;

  if (!existing_progress) {
    // 2. Only initialize for NEW users
    is_new_user = true;
    const contents = await getLiteProductContents(client, product_id);
    const first_content = contents[0];

    if (first_content) {
      await initializeLiteProgress(client, {
        sns_type,
        sns_id,
        learning_product_id: product_id,
        current_content_id: first_content.id,
        total_cards_count: 10,
      });
    }
  }

  // 3. Differential Messaging based on status
  try {
    const message = is_new_user 
      ? `👋 Welcome to Nudge!\n\nYou've started **${product.name}**.` 
      : `✨ Welcome back!\n\nYou're already subscribed to **${product.name}**. We'll keep sending your daily nudges!`;
    
    await send_discord_message(sns_id, message);
  } catch (error) {
    console.error("Discord message failed:", error);
  }

  // 4. the First Learning Card.
  const contents = await getLiteProductContents(client, product_id);
  const first_content = contents[0];

  if (first_content) {
    // 1. Initialize Progress
    await initializeLiteProgress(client, {
      sns_type,
      sns_id,
      learning_product_id: product_id,
      current_content_id: first_content.id,
      total_cards_count: 10,
    });

    // 2. Fetch the very first card
    const first_card = await getFirstCardOfContent(client, first_content.id);

    if (first_card) {
      // Assuming cardData structure has 'title' and 'url' inside its JSON
      const card_payload = first_card.card_data as any; 
    
      await send_card_nudge(sns_id, {
        title: card_payload.title || "New Learning Session", 
        url: card_payload.url || "#" 
      });
    
      await updateProgressLastCard(client, {
        sns_type,
        sns_id,
        learning_product_id: product_id,
        last_card_id: first_card.id // Existing table PK is 'id'
      });
    }
  }

  return { product_title: product.name, is_new_user };
}

export default function LiteSuccessPage({ loaderData }: Route.ComponentProps) {
  const { product_title } = loaderData;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-4xl shadow-inner">
        ✅
      </div>
      
      <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-6xl">
        Connection Successful!
      </h1>
      
      <p className="mx-auto mt-6 max-w-md text-lg text-slate-500 leading-relaxed">
        You are now subscribed to <span className="font-bold text-slate-900">{product_title}</span>. 
        Check your <span className="text-indigo-600 font-bold">Discord DM</span> for the welcome message.
      </p>

      <div className="mt-12">
        <Link
          to="/lite"
          className="inline-block rounded-2xl bg-slate-900 px-10 py-4 text-lg font-bold text-white transition-all hover:scale-105 hover:bg-slate-800 active:scale-95 shadow-2xl"
        >
          Back to Course List
        </Link>
      </div>
    </div>
  );
}