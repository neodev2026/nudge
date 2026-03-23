/**
 * [Batch Delivery API Route]
 * Triggered by Supabase Cron Job to process pending nudges.
 * Implements: Fetch -> Send -> Update cycle.
 */
// import type { Route } from "./+types/delivery";
// import makeServerClient from "~/core/lib/supa-client.server";
// import { 
//   getLitePendingDeliveries, 
//   markLiteDeliveryAsSent, 
//   markLiteDeliveryAsFailed 
// } from "~/features/lite/queries";
// import { send_card_nudge } from "../lib/discord.server";

// export async function loader({ request }: Route.LoaderArgs) {
//   const url = new URL(request.url);
//   const cron_secret = request.headers.get("X-Cron-Secret");

//   // 1. Security Check: Only allow authorized cron requests
//   if (cron_secret !== process.env.CRON_SECRET) {
//     return new Response("Unauthorized", { status: 401 });
//   }

//   const [client] = makeServerClient(request);
  
//   // 2. Fetch a batch of pending items (default: 20 to avoid timeout)
//   const pending_list = await getLitePendingDeliveries(client, 20);
  
//   const results = {
//     total: pending_list.length,
//     success: 0,
//     failed: 0,
//   };

//   // 3. Process each delivery in the batch
//   for (const delivery of pending_list) {
//     try {
//       // Map JSONB card_data to message payload
//       const card_payload = (delivery.learning_card as any)?.card_data || {};
//       const card_title = card_payload.title || "Daily Nudge";
      
//       // Use the delivery_id for the secure URL
//       const secure_url = `${url.origin}/lite/cards/${delivery.delivery_id}`;

//       // 4. Send actual SNS message
//       await send_card_nudge(delivery.sns_id, {
//         title: card_title,
//         url: secure_url
//       });

//       // 5. Mark as success
//       await markLiteDeliveryAsSent(client, delivery.delivery_id);
//       results.success++;
//     } catch (error: any) {
//       console.error(`[Cron] Delivery ${delivery.delivery_id} failed:`, error);
      
//       // 6. Record failure and increment retry count
//       await markLiteDeliveryAsFailed(client, {
//         delivery_id: delivery.delivery_id,
//         error_message: error.message || "Unknown SNS error"
//       });
//       results.failed++;
//     }
//   }

//   return Response.json({ message: "Batch processing completed", results });
// }