// features/learning-card/screens/learning-card.tsx

import type { Route } from "./+types/learning-card";
import { data, useFetcher } from "react-router";
import { toast } from "sonner";
import makeServerClient from "~/core/lib/supa-client.server";
import { FlashCard } from "../components/flash-card";
import { type StandardizedCardData } from "../types";

export async function loader({ params, request }: Route.LoaderArgs) {
  const { cardId } = params;
  const [client] = makeServerClient(request);

  // 데이터 로드 및 관계 쿼리 (학습 콘텐츠 이름 포함)
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
    throw data("카드를 불러오는 중 오류가 발생했습니다.", { status: 404 });
  }

  return {
    cardId: card.id,
    cardType: card.card_type,
    // JSONB 필드 타입을 StandardizedCardData로 명시적 캐스팅
    cardData: card.card_data as unknown as StandardizedCardData,
    contentName: (card.learning_content as any)?.content_name ?? "Unknown",
  };
}

export default function LearningCardScreen({ loaderData }: Route.ComponentProps) {
  const { cardType, cardData, contentName } = loaderData;
  const fetcher = useFetcher();

  const handleFeedback = (score: number) => {
    fetcher.submit(
      { score: score.toString() },
      { method: "post" }
    );
    toast.success(`${score}점을 기록했습니다!`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
      <div className="mb-6 text-center space-y-1">
        <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Target Word</h3>
        <p className="text-3xl font-black text-primary tracking-tight">{contentName}</p>
      </div>

      <FlashCard 
        cardType={cardType} 
        data={cardData} 
        onFeedback={handleFeedback} 
      />
    </div>
  );
}