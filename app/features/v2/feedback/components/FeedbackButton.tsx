import { useState } from "react";
import { useLocation } from "react-router";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/core/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/core/components/ui/popover";
import { useMediaQuery } from "~/hooks/use-media-query";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: "error",      label: "🚨 오류 신고" },
  { value: "content",    label: "📝 콘텐츠 오류" },
  { value: "suggestion", label: "💡 개선 제안" },
  { value: "other",      label: "💬 기타" },
] as const;

const TRIGGER_CLASS =
  "fixed bottom-6 right-6 z-50 flex items-center rounded-full bg-[#1a2744] px-4 py-3 text-white shadow-lg transition-opacity hover:opacity-90";

// ---------------------------------------------------------------------------
// FeedbackForm — shared form content for both Popover and Sheet
// ---------------------------------------------------------------------------

interface FeedbackFormProps {
  category: string;
  content: string;
  submitting: boolean;
  onCategoryChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onSubmit: () => void;
}

function FeedbackForm({
  category,
  content,
  submitting,
  onCategoryChange,
  onContentChange,
  onSubmit,
}: FeedbackFormProps) {
  return (
    <>
      {/* Category buttons */}
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onCategoryChange(c.value)}
            className={[
              "rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors",
              category === c.value
                ? "border-[#1a2744] bg-[#1a2744] text-white"
                : "border-[#e8ecf5] bg-[#f4f6fb] text-[#4b5a7a] hover:border-[#1a2744] hover:bg-white",
            ].join(" ")}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div className="mt-4">
        <textarea
          placeholder="불편하신 점이나 제안을 자유롭게 적어주세요 (최소 10자)"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={5}
          className="w-full resize-none rounded-xl border-2 border-[#e8ecf5] bg-[#f4f6fb] px-3 py-2.5 text-sm text-[#1a2744] placeholder:text-[#9aa5c0] focus:border-[#1a2744] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[#6b7a99]">
          {content.length}자{content.length < 10 && " (최소 10자)"}
        </p>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!category || content.length < 10 || submitting}
        className="mt-4 w-full rounded-xl bg-[#1a2744] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "전송 중..." : "피드백 보내기"}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// FeedbackButton
// ---------------------------------------------------------------------------

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleSubmit = async () => {
    if (!category || content.length < 10 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v2/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          content,
          page_url: location.pathname + location.search,
        }),
      });
      if (res.ok) {
        toast("감사합니다! 피드백이 전달됐어요 🙏");
        setOpen(false);
        setCategory("");
        setContent("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formProps: FeedbackFormProps = {
    category,
    content,
    submitting,
    onCategoryChange: setCategory,
    onContentChange: setContent,
    onSubmit: handleSubmit,
  };

  // ── Desktop: Popover ──────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={TRIGGER_CLASS} aria-label="피드백 보내기">
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span className="ml-1.5 text-sm font-semibold">피드백</span>
          </button>
        </PopoverTrigger>
        {/* bg-white overrides bg-popover via tailwind-merge (className comes last in cn()) */}
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="w-80 border-[#e8ecf5] bg-white p-4 shadow-xl"
        >
          <h3 className="mb-3 font-bold text-[#1a2744]">피드백 보내기</h3>
          <FeedbackForm {...formProps} />
        </PopoverContent>
      </Popover>
    );
  }

  // ── Mobile: Sheet bottom ──────────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={TRIGGER_CLASS}
        aria-label="피드백 보내기"
      >
        <MessageCircle className="h-5 w-5 shrink-0" />
        <span className="ml-1.5 hidden text-sm font-semibold sm:inline">피드백</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        {/* bg-white overrides bg-background (dark CSS var) via tailwind-merge */}
        <SheetContent
          side="bottom"
          className="max-h-[80vh] overflow-y-auto rounded-t-xl bg-white"
        >
          <div className="px-4 pb-8">
            <SheetHeader>
              <SheetTitle className="text-[#1a2744]">피드백 보내기</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FeedbackForm {...formProps} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
