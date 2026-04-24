/**
 * /products/:slug/marathon/result/:runId
 *
 * Marathon completion result — current run score + all-runs trend table.
 */
import { useLoaderData } from "react-router";
import { Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getMarathonProduct,
  getMarathonCompletedRuns,
} from "../lib/queries.server";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { slug, runId } = params;
  if (!slug || !runId) throw new Response("Not Found", { status: 404 });

  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw redirect(`/login?next=/products/${slug}/marathon`);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const product = await getMarathonProduct(adminClient, slug);

  // Load the specific completed run (must belong to this user)
  const { data: current_run, error: run_err } = await adminClient
    .from("nv2_marathon_runs")
    .select("id, run_number, score, total_questions, elapsed_seconds, completed_at")
    .eq("id", runId)
    .eq("auth_user_id", user.id)
    .eq("product_id", product.id)
    .eq("status", "completed")
    .single();

  if (run_err || !current_run) throw new Response("Not Found", { status: 404 });

  const all_runs = await getMarathonCompletedRuns(adminClient, user.id, product.id);

  return {
    productSlug: slug,
    productName: product.name,
    currentRun: current_run,
    allRuns: all_runs,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number | null): string {
  if (seconds == null) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function calcPct(score: number | null, total: number | null): string {
  if (score == null || total == null || total === 0) return "-";
  return `${Math.round((score / total) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarathonResultPage() {
  const { productSlug, productName, currentRun, allRuns } =
    useLoaderData<typeof loader>();

  const pct = calcPct(currentRun.score, currentRun.total_questions);
  const pct_num =
    currentRun.score != null && currentRun.total_questions
      ? Math.round((currentRun.score / currentRun.total_questions) * 100)
      : null;

  const grade =
    pct_num == null
      ? null
      : pct_num >= 90
      ? { label: "완벽해요!", color: "#4caf72" }
      : pct_num >= 70
      ? { label: "잘했어요!", color: "#5865f2" }
      : { label: "다시 도전해봐요", color: "#f59e0b" };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Link
            to={`/products/${productSlug}/marathon`}
            className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0"
            aria-label="마라톤으로"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 truncate">{productName}</p>
            <p className="text-sm font-medium text-gray-900">마라톤 완주</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 flex flex-col gap-6">

          {/* Hero — current run */}
          <div className="rounded-2xl bg-[#1a2744] text-white px-5 py-6 text-center">
            <p className="text-xs text-white/50 mb-1">
              {currentRun.run_number}회차 완주
            </p>
            <div className="text-5xl font-black tracking-tight mb-1">
              {pct}
            </div>
            <p className="text-sm text-white/70">
              {currentRun.score ?? "-"} / {currentRun.total_questions ?? "-"} 정답
            </p>
            {grade && (
              <p
                className="mt-3 text-sm font-bold"
                style={{ color: grade.color }}
              >
                {grade.label}
              </p>
            )}
            <p className="mt-3 text-xs text-white/40">
              소요 시간 {formatTime(currentRun.elapsed_seconds)}
            </p>
          </div>

          {/* Trend table */}
          {allRuns.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                회차별 기록
              </h2>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-16">회차</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">점수</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">정답률</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">소요 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRuns.map((run, i) => {
                      const is_current = run.id === currentRun.id;
                      return (
                        <tr
                          key={run.id}
                          className={`border-b border-gray-50 last:border-0 ${
                            is_current ? "bg-[#5865f2]/5" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${is_current ? "text-[#5865f2]" : "text-gray-400"}`}>
                              {run.run_number}회차{is_current ? " ●" : ""}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">
                            {run.score ?? "-"}/{run.total_questions ?? "-"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            <span
                              className={`font-semibold ${
                                is_current ? "text-[#5865f2]" : "text-gray-700"
                              }`}
                            >
                              {calcPct(run.score, run.total_questions)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums text-xs">
                            {formatTime(run.elapsed_seconds)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-auto pb-6">
            <Link
              to={`/products/${productSlug}/marathon`}
              className="block w-full py-3 text-center text-sm font-semibold text-white bg-[#1a2744] rounded-xl hover:bg-[#243358] transition-colors"
            >
              다시 마라톤 →
            </Link>
            <Link
              to={`/products/${productSlug}`}
              className="block w-full py-3 text-center text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
            >
              상품 페이지로
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
