/**
 * /admin/feedback
 *
 * Lists user-submitted feedback.
 * Supports toggling is_resolved per item.
 * Unresolved items are shown first.
 */
import type { Route } from "./+types/feedback";

import { useLoaderData, useFetcher } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "피드백 관리 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const { data, error } = await (adminClient as any)
    .from("nv2_feedback")
    .select("id, auth_user_id, page_url, category, content, is_resolved, admin_note, created_at")
    .order("is_resolved", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return { feedbacks: (data ?? []) as FeedbackRow[] };
}

// ---------------------------------------------------------------------------
// Action — toggle is_resolved
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const body = await request.json().catch(() => null);
  if (!body?.id) return Response.json({ ok: false }, { status: 400 });

  const { error } = await (adminClient as any)
    .from("nv2_feedback")
    .update({ is_resolved: body.resolved })
    .eq("id", body.id);

  if (error) throw new Error(error.message);

  return Response.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackRow {
  id: string;
  auth_user_id: string | null;
  page_url: string;
  category: "error" | "content" | "suggestion" | "other";
  content: string;
  is_resolved: boolean;
  admin_note: string | null;
  created_at: string;
}

const CATEGORY_LABEL: Record<FeedbackRow["category"], string> = {
  error:      "🚨 오류 신고",
  content:    "📝 콘텐츠 오류",
  suggestion: "💡 개선 제안",
  other:      "💬 기타",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminFeedback() {
  const { feedbacks } = useLoaderData<typeof loader>();

  const unresolved = feedbacks.filter((f) => !f.is_resolved);
  const resolved   = feedbacks.filter((f) => f.is_resolved);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-black text-[#1a2744]">
          피드백 관리
        </h1>
        <p className="mt-1 text-sm text-[#6b7a99]">
          사용자 피드백 및 오류 신고를 확인합니다
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 flex gap-4">
        <div className="rounded-xl border border-[#e8ecf5] bg-white px-5 py-4">
          <p className="text-xs text-[#6b7a99]">미처리</p>
          <p className="mt-1 text-2xl font-black text-[#1a2744]">{unresolved.length}</p>
        </div>
        <div className="rounded-xl border border-[#e8ecf5] bg-white px-5 py-4">
          <p className="text-xs text-[#6b7a99]">처리 완료</p>
          <p className="mt-1 text-2xl font-black text-[#4caf72]">{resolved.length}</p>
        </div>
      </div>

      {feedbacks.length === 0 ? (
        <p className="text-sm text-[#6b7a99]">제출된 피드백이 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[#e8ecf5] bg-[#f4f6fb]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[#6b7a99]">시각</th>
                <th className="px-4 py-3 text-left font-semibold text-[#6b7a99]">카테고리</th>
                <th className="px-4 py-3 text-left font-semibold text-[#6b7a99]">내용</th>
                <th className="px-4 py-3 text-left font-semibold text-[#6b7a99]">페이지</th>
                <th className="px-4 py-3 text-left font-semibold text-[#6b7a99]">사용자</th>
                <th className="px-4 py-3 text-left font-semibold text-[#6b7a99]">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8ecf5]">
              {feedbacks.map((fb) => (
                <FeedbackRow key={fb.id} feedback={fb} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FeedbackRow — individual row with resolve toggle
// ---------------------------------------------------------------------------

function FeedbackRow({ feedback }: { feedback: FeedbackRow }) {
  const fetcher = useFetcher();

  const optimistic_resolved =
    fetcher.state !== "idle"
      ? (fetcher.json as any)?.resolved ?? feedback.is_resolved
      : feedback.is_resolved;

  const toggle = () => {
    fetcher.submit(
      { id: feedback.id, resolved: !optimistic_resolved },
      { method: "POST", encType: "application/json" }
    );
  };

  const date = new Date(feedback.created_at).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <tr className={optimistic_resolved ? "opacity-50" : ""}>
      <td className="whitespace-nowrap px-4 py-3 text-[#6b7a99]">{date}</td>
      <td className="whitespace-nowrap px-4 py-3">{CATEGORY_LABEL[feedback.category]}</td>
      <td className="max-w-xs px-4 py-3 text-[#1a2744]">
        <span title={feedback.content}>
          {feedback.content.slice(0, 50)}
          {feedback.content.length > 50 && "…"}
        </span>
      </td>
      <td className="max-w-[160px] truncate px-4 py-3 text-[#6b7a99]">
        <span title={feedback.page_url}>{feedback.page_url}</span>
      </td>
      <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-[#6b7a99]">
        {feedback.auth_user_id ?? "비로그인"}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          className={[
            "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
            optimistic_resolved
              ? "bg-[#e8ecf5] text-[#6b7a99] hover:bg-[#d0d6e8]"
              : "bg-[#4caf72] text-white hover:bg-[#3d9960]",
          ].join(" ")}
        >
          {optimistic_resolved ? "완료됨" : "처리 완료"}
        </button>
      </td>
    </tr>
  );
}
