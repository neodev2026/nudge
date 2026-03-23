/**
 * [Lite Learning Card Page]
 * High-contrast, interactive card view for Lite users.
 * Features: Visual content display and immediate 1-5 feedback.
 */
import type { Route } from "./+types/learning-card-page";
import { useLoaderData, useSearchParams, Form, redirect } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import { getLiteCardDetail, recordLiteFeedback } from "../queries";

/**
 * Loader: Fetches the card content based on card_id from URL.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const { card_id } = params;
  const [client] = makeServerClient(request);

  if (!card_id) throw new Error("Card ID is required");

  const card = await getLiteCardDetail(client, card_id);
  return { card };
}

/**
 * Action: Processes the 1-5 feedback rating.
 */
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const score = Number(formData.get("score"));
  
  const url = new URL(request.url);
  const sns_id = url.searchParams.get("sns_id");
  const product_id = url.searchParams.get("product_id");
  const sns_type = "discord";

  if (sns_id && product_id && score) {
    const [client] = makeServerClient(request);
    await recordLiteFeedback(client, { 
      sns_type, sns_id, learning_product_id: product_id, score 
    });
    
    // Redirect to a 'Great Job' or 'Next' state
    return redirect(`/lite/success?product_id=${product_id}&sns_id=${sns_id}&feedback=recorded`);
  }
  return null;
}

export default function LiteLearningCardPage({ loaderData }: Route.ComponentProps) {
  const { card } = loaderData;
  const card_payload = card.card_data as any; // StandardizedCardData

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-12 md:py-24">
      {/* 1. PROGRESS INDICATOR: Minimalist bar */}
      <div className="mb-12 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/3 bg-emerald-500 transition-all duration-500" />
      </div>

      {/* 2. CARD CONTENT: Large typography and clean layout */}
      <article className="flex flex-col">
        <h1 className="text-3xl font-black leading-tight text-slate-900 md:text-5xl">
          {card_payload.title || "Daily Nudge"}
        </h1>
        
        {/* Visual Content Placeholder */}
        <div className="my-10 aspect-video w-full rounded-[2rem] bg-slate-100 shadow-inner" />

        <div className="prose prose-slate max-w-none text-lg text-slate-600 leading-relaxed">
          {card_payload.description || "Master this concept by reviewing the details above."}
        </div>
      </article>

      {/* 3. FEEDBACK SECTION: Brilliant-style rating buttons */}
      <section className="mt-16 border-t border-slate-100 pt-12 text-center">
        <h2 className="mb-8 text-xl font-bold text-slate-900">How clear was this card?</h2>
        <Form method="post" className="flex justify-center gap-3 md:gap-4">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="submit"
              name="score"
              value={score}
              className="group flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 text-xl font-black transition-all hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 active:scale-90 md:h-16 md:w-16"
            >
              {score}
            </button>
          ))}
        </Form>
        <p className="mt-6 text-sm font-medium text-slate-400 uppercase tracking-widest">
          Tap a number to complete today's session
        </p>
      </section>
    </div>
  );
}