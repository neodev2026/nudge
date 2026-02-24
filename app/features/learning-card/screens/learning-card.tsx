/**
 * Learning Card Screen (Simplified Version)
 */
import type { Route } from "./+types/learning-card";
import { data, useFetcher, redirect } from "react-router";
import { toast } from "sonner";
import { CheckCircle2Icon } from "lucide-react";

import makeServerClient from "~/core/lib/supa-client.server";
import { FlashCard } from "../components/flash-card";
import { type StandardizedCardData } from "../types";
import { processCardFeedback } from "../lib/services.server";
import { Button } from "~/core/components/ui/button";

export async function loader({ params, request }: Route.LoaderArgs) {
  const { cardId } = params;
  const [client] = makeServerClient(request);
  const url = new URL(request.url);
  const deliveryId = url.searchParams.get("delivery_id");

  if (!deliveryId) {
    throw data("Missing valid delivery information.", { status: 400 });
  }

  const { data: card, error } = await client
    .from("learning_card")
    .select(`id, card_type, card_data, learning_content (content_name)`)
    .eq("id", cardId)
    .single();

  if (error || !card) throw data("Could not load the requested card.", { status: 404 });

  return {
    cardId: card.id,
    deliveryId,
    cardType: card.card_type,
    cardData: card.card_data as unknown as StandardizedCardData,
    contentName: (card.learning_content as any)?.content_name ?? "Unknown",
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) return redirect("/auth/login");

  const formData = await request.formData();
  const score = Number(formData.get("score"));
  const deliveryId = formData.get("deliveryId") as string;
  const cardId = formData.get("cardId") as string;

  try {
    const result = await processCardFeedback({
      userId: user.id,
      deliveryId,
      cardId,
      quality: score,
    });
    // [Fixed] Return the result to update fetcher.data
    return data(result); 
  } catch (error) {
    throw data("Failed to save progress.", { status: 500 });
  }
}

export default function LearningCardScreen({ loaderData }: Route.ComponentProps) {
  const { cardId, deliveryId, cardType, cardData, contentName } = loaderData;
  const fetcher = useFetcher();

  // Check if the feedback has been successfully processed
  const isCompleted = fetcher.data?.success === true;
  const isSubmitting = fetcher.state !== "idle";

  const handleFeedback = (score: number) => {
    if (isCompleted) return; // Prevent double submission
    fetcher.submit(
      { score: score.toString(), deliveryId, cardId },
      { method: "post" }
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
      <div className="mb-6 text-center space-y-1">
        <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Target Word</h3>
        <p className="text-3xl font-black text-primary tracking-tight">{contentName}</p>
      </div>

      <div className="w-full max-w-lg space-y-8">
        {!isCompleted && (
          <FlashCard 
            cardType={cardType} 
            data={cardData} 
            onFeedback={handleFeedback} 
            // If completed, disable the interaction inside FlashCard
            isSubmitting={isSubmitting || isCompleted} 
          />
        )}

        {/* [New] Show Completion State */}
        {isCompleted && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button 
              disabled 
              className="w-full h-16 rounded-2xl bg-green-500/10 text-green-600 border-2 border-green-500/20 font-black uppercase tracking-widest text-sm"
            >
              <CheckCircle2Icon className="mr-2 size-5" />
              Feedback Complete
            </Button>
            
            {/* <Button asChild variant="ghost" className="w-full font-bold text-muted-foreground hover:text-primary transition-colors">
              <a href="/my/dashboard">Return to Dashboard</a>
            </Button> */}
          </div>
        )}
      </div>
    </div>
  );
}