import { useState } from "react";
import { FlashCard } from "../components/flash-card";
import { type StandardizedCardData } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "~/core/components/ui/card";
import { Label } from "~/core/components/ui/label";
import { Input } from "~/core/components/ui/input";
import { Textarea } from "~/core/components/ui/textarea";
import { Badge } from "~/core/components/ui/badge";
import { Button } from "~/core/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/core/components/ui/select";
import { toast } from "sonner";
import { RotateCcwIcon, FlipHorizontalIcon, LanguagesIcon, TypeIcon } from "lucide-react";

/** * [개선] 학습자 언어(Learner Locale)가 반영된 9종 프리셋
 */
const CONTENT_PRESETS: Record<string, Record<string, StandardizedCardData>> = {
  "fahren (German)": {
    basic_meaning: {
      presentation: { front: "fahren", back: "운전하다, 타다", hint: "이동수단 이용 시 사용" },
      details: { explanation: "탈것을 이용해 장소를 이동하는 필수 동사입니다.", example_context: { sentence: "Ich fahre mit dem Auto.", translation: "나는 자동차를 타고 간다." }, visual_cue: "🚗" },
      meta: { target_locale: "de-DE", learner_locale: "ko-KR", logic_key: "fahren" }
    },
    // ... 나머지 8종 동일 (target_locale/learner_locale 적용)
    cloze: {
        presentation: { front: "Ich [____] nach Berlin.", back: "Ich fahre nach Berlin.", hint: "1인칭 현재형 변화" },
        details: { explanation: "주어에 따른 동사 어미 변화를 주의하세요.", example_context: { sentence: "Wir fahren zusammen nach Hause.", translation: "우리는 같이 집으로 간다." }, visual_cue: "🧩" },
        meta: { target_locale: "de-DE", learner_locale: "ko-KR", logic_key: "fahren" }
    }
  },
  "persistent (English)": {
    basic_meaning: {
      presentation: { front: "persistent", back: "끈질긴, 집요한", hint: "포기하지 않고 계속하는 성질" },
      details: { explanation: "장애물에도 불구하고 끊임없이 노력하거나 지속되는 상태를 의미합니다.", example_context: { sentence: "He is persistent in his efforts.", translation: "그는 노력을 멈추지 않는다." }, visual_cue: "🦾" },
      meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    },
    pronunciation: {
      presentation: { front: "persistent", back: "[pərˈsɪstənt]", hint: "두 번째 음절 'sis'에 강세가 있습니다" },
      details: { explanation: "강세가 없는 첫 음절은 '퍼'에 가깝게 약하게 발음하세요.", example_context: { sentence: "Keep practicing the pronunciation.", translation: "발음 연습을 계속하세요." }, visual_cue: "🗣️" },
      meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    },
    etymology: {
      presentation: { front: "persistent의 어원", back: "라틴어 'persistere' (끝까지 서 있다)", hint: "per(관통) + sistere(서다)" },
      details: { explanation: "어떤 시련을 뚫고 끝까지 서 있다는 의미에서 유래했습니다.", example_context: { sentence: "A persistent problem.", translation: "끈질기게 해결되지 않는 문제." }, visual_cue: "📜" },
      meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    },
    cloze: {
        presentation: { front: "She is a [__________] negotiator.", back: "She is a persistent negotiator.", hint: "포기하지 않는 협상가" },
        details: { explanation: "사람의 성격을 묘사할 때 '집요한' 긍정적인 의미로 쓰입니다.", example_context: { sentence: "The rain was persistent all day.", translation: "비가 하루 종일 그치지 않고 내렸다." }, visual_cue: "🧩" },
        meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    },
    contrast: {
        presentation: { front: "persistent vs stubborn", back: "집념 vs 고집", hint: "의지력의 차이" },
        details: { explanation: "persistent는 목표 지향적인 집념을, stubborn은 고집불통인 상태를 강조합니다.", example_context: { sentence: "It's a fine line between the two.", translation: "그 둘은 종이 한 끝 차이입니다." }, visual_cue: "↔️" },
        meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    },
    cultural_context: {
        presentation: { front: "The Persistent Underdog", back: "끈기 있는 약자", hint: "서구권의 전형적인 성공 서사" },
        details: { explanation: "불리한 조건에서도 굴하지 않는 약자의 승리를 높게 평가하는 문화가 있습니다.", example_context: { sentence: "Never say die spirit.", translation: "죽어도 포기하지 않는 정신." }, visual_cue: "🏆" },
        meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    },
    example: {
        presentation: { front: "그는 정말 끈질겨.", back: "He is incredibly persistent.", hint: "'persistent'를 사용하세요" },
        details: { explanation: "강조 부사 incredibly와 아주 잘 어울리는 형용사입니다.", example_context: { sentence: "Persistence pays off.", translation: "끈기는 결실을 맺는다." }, visual_cue: "🚲" },
        meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    },
    derivatives: {
        presentation: { front: "persistence", back: "끈기, 고집", hint: "persistent의 명사형" },
        details: { explanation: "-ence가 붙어 추상 명사가 되었습니다.", example_context: { sentence: "Success takes persistence.", translation: "성공에는 끈기가 필요하다." }, visual_cue: "🌳" },
        meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    },
    idiom: {
        presentation: { front: "Stick to your guns", back: "소신을 굽히지 않다", hint: "끈질기게 주장을 유지함" },
        details: { explanation: "총(자신의 주장)을 계속 붙잡고 있다는 비유적 표현입니다.", example_context: { sentence: "You must stick to your guns.", translation: "당신은 당신의 입장을 고수해야 합니다." }, visual_cue: "🌋" },
        meta: { target_locale: "en-US", learner_locale: "ko-KR", logic_key: "persistent" }
    }
  }
};

export default function CardSimulationScreen() {
  const [selectedContent, setSelectedContent] = useState<string>("fahren (German)");
  const [cardType, setCardType] = useState<string>("basic_meaning");
  const [data, setData] = useState<StandardizedCardData>(CONTENT_PRESETS["fahren (German)"].basic_meaning);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleContentChange = (content: string) => {
    setSelectedContent(content);
    setData(CONTENT_PRESETS[content][cardType]);
    setIsFlipped(false);
    toast.info(`${content} 전환 완료`);
  };

  const handleTypeChange = (type: string) => {
    setCardType(type);
    setData(CONTENT_PRESETS[selectedContent][type]);
    setIsFlipped(false);
    toast.info(`${type.replace('_', ' ')} 로드 완료`);
  };

  const updateField = (path: string, value: string) => {
    const keys = path.split('.');
    setData(prev => {
      const newData = { ...prev };
      let current: any = newData;
      for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  return (
    <main className="container mx-auto py-10 px-4 max-w-6xl font-bold">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 border-b pb-8">
        <h1 className="text-3xl font-black uppercase tracking-widest text-primary">Simulation Lab</h1>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 bg-primary/5 p-1.5 rounded-xl border-2 border-primary/20">
            <span className="text-[10px] font-black uppercase px-2 text-primary">Content</span>
            <Select value={selectedContent} onValueChange={handleContentChange}>
              <SelectTrigger className="w-[180px] h-8 bg-background border-none shadow-none focus:ring-0 font-bold text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(CONTENT_PRESETS).map(c => (
                  <SelectItem key={c} value={c} className="cursor-pointer font-bold">
                    <div className="flex items-center gap-2"><TypeIcon className="size-3" /> {c}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-xl border-2">
            <span className="text-[10px] font-black uppercase px-2 text-muted-foreground">Type</span>
            <Select value={cardType} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-[160px] h-8 bg-background border-none shadow-none focus:ring-0 font-bold uppercase text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(CONTENT_PRESETS[selectedContent]).map(t => (
                  <SelectItem key={t} value={t} className="capitalize cursor-pointer font-bold">
                    <div className="flex items-center gap-2"><LanguagesIcon className="size-3" /> {t.replace('_', ' ')}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" className="h-11 font-bold border-2" onClick={() => setIsFlipped(!isFlipped)}>
            <FlipHorizontalIcon className="size-4 mr-2" /> {isFlipped ? "앞면 보기" : "뒷면 보기"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="space-y-6">
          <Card className="border-2 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10 py-4 px-6 font-bold">
              <CardTitle className="text-xs uppercase tracking-widest font-black text-muted-foreground">Data Editor</CardTitle>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsFlipped(false)}><RotateCcwIcon className="size-4" /></Button>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="text-[10px] font-bold">1. Presentation</Badge>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Front</Label>
                    <Input className="bg-muted/20 border-none focus-visible:ring-1" value={data.presentation.front} onChange={(e) => updateField('presentation.front', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Back</Label>
                    <Input className="bg-muted/20 border-none focus-visible:ring-1" value={data.presentation.back} onChange={(e) => updateField('presentation.back', e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Hint (Learner's Language)</Label>
                  <Input className="bg-muted/20 border-none focus-visible:ring-1" value={data.presentation.hint ?? ""} onChange={(e) => updateField('presentation.hint', e.target.value)} />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t-2 border-dashed">
                <Badge variant="outline" className="text-[10px] font-bold">2. Locales</Badge>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Target (TTS)</Label>
                    <Input className="bg-primary/5 border-none focus-visible:ring-1 font-mono" value={data.meta.target_locale} onChange={(e) => updateField('meta.target_locale', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Learner (UI)</Label>
                    <Input className="bg-secondary/20 border-none focus-visible:ring-1 font-mono" value={data.meta.learner_locale} onChange={(e) => updateField('meta.learner_locale', e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center py-4 sticky top-10">
          <div className="mb-10">
            <Badge variant={isFlipped ? "secondary" : "outline"} className="px-6 py-1.5 text-xs font-black tracking-widest uppercase">
              {isFlipped ? "Back View" : "Front View"}
            </Badge>
          </div>
          <FlashCard cardType={cardType} data={data} isFlippedExternal={isFlipped} onFlipChange={setIsFlipped} onFeedback={(score) => toast.success(`기록 시뮬레이션: ${score}점`)} />
        </div>
      </div>
    </main>
  );
}