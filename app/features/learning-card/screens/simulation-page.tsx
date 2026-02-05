import { useState } from "react";
import { useSearchParams, useNavigation } from "react-router";
import { data } from "react-router";
import { z } from "zod";
import { toast } from "sonner";
import { 
  SearchIcon, 
  DatabaseIcon, 
  Loader2Icon, 
  FlipHorizontalIcon, 
  InfoIcon 
} from "lucide-react";

// 서버 전용 모듈 (Server-only)
import makeServerClient from "~/core/lib/supa-client.server";
import { getCardsByContentId } from "../queries";

// 공용 컴포넌트 및 UI
import { FlashCard } from "../components/flash-card";
import { type StandardizedCardData } from "../types";
import { Input } from "~/core/components/ui/input";
import { Button } from "~/core/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "~/core/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "~/core/components/ui/select";
import { Badge } from "~/core/components/ui/badge";
import { Label } from "~/core/components/ui/label";

import type { Route } from "./+types/simulation-page";

/**
 * [wemake Style] Zod를 이용한 파라미터 검증 스키마
 */
const searchSchema = z.object({
  contentId: z.string().uuid("올바른 UUID 형식이 아닙니다.").optional().nullable(),
});

/**
 * [wemake Style] Server-Side Loader
 * 이 함수는 서버에서만 실행되므로 보안이 필요한 서버 클라이언트를 안전하게 사용합니다.
 */
export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  
  // Zod 검증
  const parsed = searchSchema.safeParse(searchParams);
  const contentId = parsed.success ? parsed.data.contentId : null;

  const [client, headers] = makeServerClient(request);

  let cards: any[] = [];
  if (contentId) {
    try {
      // 쿼리 함수 호출
      cards = await getCardsByContentId(client, { contentId });
    } catch (e) {
      console.error("데이터 조회 실패:", e);
    }
  }

  // 데이터와 함께 인증 헤더를 반환하여 세션을 유지합니다.
  return data({ cards, contentId }, { headers });
};

/**
 * [wemake Style] Inspector Component
 */
export default function SimulationPage({ loaderData }: Route.ComponentProps) {
    debugger;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  
  // 상태 관리
  const [queryInput, setQueryInput] = useState(loaderData.contentId || "");
  const [isFlipped, setIsFlipped] = useState(false);

  // 로더 데이터를 카드 타입별 Map으로 가공
  const cardsMap: Record<string, StandardizedCardData> = {};
  loaderData.cards.forEach((row: any) => {
    cardsMap[row.card_type] = row.card_data as StandardizedCardData;
  });

  const cardTypes = Object.keys(cardsMap);
  const [selectedType, setSelectedType] = useState<string>(cardTypes[0] || "");
  const currentCard = cardsMap[selectedType];

  /**
   * [wemake Style] URL 파라미터를 업데이트하여 서버 로더를 트리거합니다.
   */
  const handleSearch = () => {
    debugger;
    const trimmedId = queryInput.trim();
    if (!trimmedId) {
      toast.error("ID를 입력해주세요.");
      return;
    }

    const newParams = new URLSearchParams(searchParams);
    newParams.set("contentId", trimmedId);
    setSearchParams(newParams, { preventScrollReset: true });
  };

  return (
    <div className="container mx-auto py-10 space-y-10 font-bold">
      {/* 검색 헤더 섹션 */}
      <section className="flex flex-col md:flex-row items-center justify-between gap-6 border-b pb-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-primary italic">INSPECTOR v1</h1>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
            AI-Generated Card Verification Tool
          </p>
        </div>

        <div className="flex w-full md:w-auto items-center gap-2">
          <div className="relative flex-1 md:w-96">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Content UUID를 입력하세요"
              className="pl-10 font-mono text-[10px] h-12 border-2 focus-visible:ring-primary shadow-sm"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={isLoading} 
            className="h-12 px-8 font-black uppercase text-xs transition-all hover:scale-105"
          >
            {isLoading ? <Loader2Icon className="animate-spin size-4" /> : "Fetch Data"}
          </Button>
        </div>
      </section>

      {currentCard ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* 왼쪽: 메타데이터 및 상세 정보 */}
          <div className="space-y-6">
            <Card className="border-2 shadow-none rounded-[2rem] overflow-hidden">
              <CardHeader className="border-b bg-muted/30 py-6 px-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-lg text-primary-foreground">
                      <DatabaseIcon className="size-4" />
                    </div>
                    <CardTitle className="text-xs font-black uppercase tracking-tighter">Raw Meta Data</CardTitle>
                  </div>
                  <Select value={selectedType} onValueChange={(val) => { setSelectedType(val); setIsFlipped(false); }}>
                    <SelectTrigger className="w-44 h-9 font-black text-[10px] uppercase border-2 rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cardTypes.map((type) => (
                        <SelectItem key={type} value={type} className="text-[10px] font-black uppercase cursor-pointer">
                          {type.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Target (Audio)</Label>
                    <Badge variant="secondary" className="w-full justify-center h-10 font-mono border-2 text-xs">
                      {currentCard.meta.target_locale}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Learner (UI)</Label>
                    <Badge variant="outline" className="w-full justify-center h-10 font-mono border-2 text-xs">
                      {currentCard.meta.learner_locale}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Logic Key</Label>
                  <div className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                    <code className="text-lg text-primary font-black">{currentCard.meta.logic_key}</code>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase ml-1 flex items-center gap-1">
                    <InfoIcon className="size-3" /> AI Explanation
                  </Label>
                  <div className="text-sm leading-relaxed p-6 bg-muted/20 rounded-3xl border-2 border-dashed font-medium text-foreground/80">
                    {currentCard.details.explanation}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 오른쪽: 컴포넌트 프리뷰 */}
          <div className="flex flex-col items-center py-8 sticky top-10">
            <div className="mb-10 flex items-center gap-4">
              <Badge className="px-8 py-2 text-[10px] font-black tracking-widest uppercase rounded-full shadow-md">
                {isFlipped ? "Back View" : "Front View"}
              </Badge>
              <Button 
                size="icon" 
                variant="outline" 
                className="size-10 rounded-full border-2 hover:bg-primary hover:text-white transition-colors" 
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <FlipHorizontalIcon className="size-4" />
              </Button>
            </div>
            
            {/* 공용 플래시카드 컴포넌트 */}
            <FlashCard 
              cardType={selectedType} 
              data={currentCard} 
              isFlippedExternal={isFlipped}
              onFlipChange={setIsFlipped}
              onFeedback={(score) => toast.success(`DB 연동 시뮬레이션 성공: ${score}점 기록`)} 
            />
          </div>
        </div>
      ) : (
        <div className="h-[500px] flex flex-col items-center justify-center border-4 border-dashed rounded-[3rem] bg-muted/5 group transition-all hover:bg-muted/10">
          <DatabaseIcon className="size-20 text-muted-foreground/10 mb-6 group-hover:scale-110 transition-transform" />
          <p className="text-muted-foreground text-xl font-black italic tracking-tight opacity-40">
            ENTER CONTENT UUID TO INSPECT
          </p>
        </div>
      )}
    </div>
  );
}