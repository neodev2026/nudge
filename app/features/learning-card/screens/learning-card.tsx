/**
 * Learning Card Screen
 * Handles the display of flashcards and captures user feedback for the SM-2 algorithm.
 */
import type { Route } from "./+types/learning-card";
import { data, useFetcher, redirect } from "react-router";
import { toast } from "sonner";

import makeServerClient from "~/core/lib/supa-client.server";
import { FlashCard } from "../components/flash-card";
import { type StandardizedCardData } from "../types";
import { processCardFeedback } from "../lib/services.server";

import { isRouteErrorResponse, useRouteError } from "react-router"; // [Added]
import { CalendarIcon, CheckCircle2Icon, TimerIcon } from "lucide-react"; // [Added]
import { Badge } from "~/core/components/ui/badge";
import { Button } from "~/core/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/core/components/ui/card";

/**
 * Server-Side Loader: Fetches card content and delivery context.
 * Expects a 'delivery_id' in the URL query parameters.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const { cardId } = params;
  const [client] = makeServerClient(request);

  // Extract deliveryId from URL query (passed from n8n Discord link)
  const url = new URL(request.url);
  const deliveryId = url.searchParams.get("delivery_id");

  // Prevent access if the delivery context is missing
  if (!deliveryId) {
    throw data("Missing valid delivery information.", { status: 400 });
  }

  const { data: card, error } = await client
    .from("learning_card")
    .select(`
      id,
      card_type,
      card_data,
      learning_content (
        content_name
      )
    `)
    .eq("id", cardId)
    .single();

  if (error || !card) {
    console.error("Supabase Error:", error);
    throw data("Could not load the requested card.", { status: 404 });
  }

  return {
    cardId: card.id,
    deliveryId, // Passed to action via fetcher
    cardType: card.card_type,
    cardData: card.card_data as unknown as StandardizedCardData,
    contentName: (card.learning_content as any)?.content_name ?? "Unknown",
  };
}

/**
 * Server-Side Action: Processes user feedback and schedules the next review.
 */
export async function action({ params, request }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

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

    // Return the result data to the fetcher
    return data(result);
  } catch (error) {
    console.error("Feedback Processing Error:", error);
    throw data("Failed to save your progress.", { status: 500 });
  }
}

export default function LearningCardScreen({ loaderData }: Route.ComponentProps) {
  const { cardId, deliveryId, cardType, cardData, contentName } = loaderData;
  const fetcher = useFetcher();

  // Access the result returned from the action
  const result = fetcher.data as { 
    success: boolean; 
    nextReviewAt: string; 
    nextCardName: string; 
    nextCardType: string;
  } | undefined;

  const handleFeedback = (score: number) => {
    fetcher.submit(
      { score: score.toString(), deliveryId, cardId },
      { method: "post" }
    );
  };

  /**
   * Helper to format the time until next review
   */
  const getWaitTime = (dateString: string) => {
    const now = new Date();
    const next = new Date(dateString);
    const diffMs = next.getTime() - now.getTime();
    const diffMins = Math.max(0, Math.round(diffMs / 60000));
    
    if (diffMins < 60) return `${diffMins} minutes`;
    if (diffMins < 1440) return `${Math.round(diffMins / 60)} hours`;
    return `${Math.round(diffMins / 1440)} days`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
      {!result?.success ? (
        // --- NORMAL LEARNING VIEW ---
        <>
          <div className="mb-6 text-center space-y-1">
            <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Target Word</h3>
            <p className="text-3xl font-black text-primary tracking-tight">{contentName}</p>
          </div>

          <FlashCard 
            cardType={cardType} 
            data={cardData} 
            onFeedback={handleFeedback} 
            isSubmitting={fetcher.state !== "idle"}
          />
        </>
      ) : (
        // --- NEXT NUDGE INFO VIEW (After Feedback) ---
        <Card className="w-full max-w-md border-4 border-primary rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500">
          <CardHeader className="text-center pt-10">
            <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle2Icon className="size-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-black uppercase italic tracking-tighter">
              Progress Saved!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="px-8 pb-10 space-y-8">
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-2xl">
                <TimerIcon className="size-6 text-primary mt-1" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Next Nudge In</p>
                  <p className="text-xl font-bold">{getWaitTime(result.nextReviewAt)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Scheduled at: {new Date(result.nextReviewAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-2xl">
                <CalendarIcon className="size-6 text-primary mt-1" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Next Card About</p>
                  <p className="text-xl font-bold">{result.nextCardName}</p>
                  <Badge variant="secondary" className="mt-1 capitalize">
                    {result.nextCardType.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </div>

            <Button asChild className="w-full h-14 rounded-full font-black uppercase text-xs tracking-widest shadow-lg">
              <a href="/my/dashboard">Go to Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}