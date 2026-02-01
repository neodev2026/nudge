import * as React from "react";
import { useState } from "react";
import { Volume2Icon } from "lucide-react";
import { cn } from "~/core/lib/utils";
import { Button } from "~/core/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "~/core/components/ui/card";
import { Badge } from "~/core/components/ui/badge";
import { type StandardizedCardData } from "../types";

interface FlashCardProps {
  cardType: string;
  data: StandardizedCardData;
  onFeedback: (score: number) => void;
  isFlippedExternal?: boolean;
  onFlipChange?: (isFlipped: boolean) => void;
}

export function FlashCard({ 
  cardType, 
  data, 
  onFeedback, 
  isFlippedExternal, 
  onFlipChange 
}: FlashCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isFlipped = isFlippedExternal !== undefined ? isFlippedExternal : internalFlipped;
  const [feedbackScore, setFeedbackScore] = useState(5);

  const { presentation, details, meta } = data;

  const handleFlip = (state: boolean) => {
    if (onFlipChange) onFlipChange(state);
    else setInternalFlipped(state);
  };

  /**
   * [개선] meta.target_locale을 기반으로 한 지능형 TTS 정책
   */
  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.speechSynthesis.cancel();

    const targetLocale = meta.target_locale || "en-US";
    let textToRead = "";

    if (cardType === 'example') {
      textToRead = presentation.back;
    } else if (cardType === 'cloze') {
      textToRead = isFlipped 
        ? presentation.back 
        : presentation.front.replace(/\[_+\]/g, "..."); 
    } else {
      textToRead = presentation.front;
    }

    if (!textToRead) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.replace('_', '-').includes(targetLocale));

    if (targetVoice) utterance.voice = targetVoice;
    utterance.lang = targetLocale;
    utterance.rate = 0.9;

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="perspective-1000 w-full max-w-md mx-auto aspect-[3/4]">
      <div
        className={cn(
          "relative w-full h-full transition-all duration-700 preserve-3d cursor-pointer",
          isFlipped ? "rotate-y-180" : ""
        )}
      >
        {/* --- FRONT --- */}
        <Card className="absolute inset-0 backface-hidden z-10 flex flex-col shadow-xl border-2 bg-card">
          <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
            <Badge variant="secondary" className="capitalize">{cardType.replace("_", " ")}</Badge>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={playAudio}>
                <Volume2Icon className="size-4 text-primary" />
              </Button>
              <span className="text-2xl">{details.visual_cue}</span>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <h2 className="text-3xl font-bold break-keep leading-tight">{presentation.front}</h2>
            {presentation.hint && (
              <p className="mt-4 text-sm text-muted-foreground italic tracking-tight">
                Tip: {presentation.hint}
              </p>
            )}
          </CardContent>

          <CardFooter className="p-6">
            <Button className="w-full h-14 text-lg font-semibold" onClick={(e) => { e.stopPropagation(); handleFlip(true); }}>
              내용 확인하기
            </Button>
          </CardFooter>
        </Card>

        {/* --- BACK --- */}
        <Card className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col shadow-xl border-primary/20 border-2 bg-card">
          <CardHeader className="flex flex-row justify-between items-center border-b pb-4 bg-muted/30">
            <Badge variant="default">내용 확인</Badge>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">{meta.logic_key}</span>
              <Button variant="outline" size="icon" className="size-7 rounded-full" onClick={playAudio}>
                <Volume2Icon className="size-3" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-primary">{presentation.back}</h3>
                <p className="mt-2 text-base leading-relaxed tracking-tight">{details.explanation}</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-tighter">Context</p>
                <p className="text-lg font-semibold italic leading-snug">{details.example_context.sentence}</p>
                <p className="text-sm mt-1 opacity-80">{details.example_context.translation}</p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 p-6 border-t bg-muted/10">
            <div className="w-full space-y-2 text-center">
              <input type="range" min="1" max="10" step="1" value={feedbackScore} onChange={(e) => setFeedbackScore(parseInt(e.target.value))} className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary" />
              <p className="font-bold text-primary text-sm">{feedbackScore}점</p>
            </div>
            <Button variant="default" className="w-full h-12" onClick={() => onFeedback(feedbackScore)}>학습 완료</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}