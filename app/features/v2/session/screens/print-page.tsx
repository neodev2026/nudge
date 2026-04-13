/**
 * /sessions/:sessionId/print
 *
 * A4 print sheet for a session's learning cards.
 * Layout: word | meaning (coverable) | example / gap-fill | write ×3
 *
 * Card structure per stage (stage_type = "learning"):
 *   display_order 1 → card_type "title"       → presentation.front = 단어, presentation.back = 의미
 *   display_order 2 → card_type "description" → presentation.back  = 설명
 *   display_order 3 → card_type "example"     → presentation.front = 예문, presentation.back = 번역
 *
 * No auth required — uses the same public access policy as session pages.
 */
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrintRow {
  index: number;
  is_first_in_stage: boolean;
  word: string;
  meaning: string;
  hint?: string;
  sentence?: string;       // example card: presentation.front
  translation?: string;    // example card: presentation.back
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }: LoaderFunctionArgs) {
  const { createClient } = await import("@supabase/supabase-js");
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { sessionId } = params;
  if (!sessionId) throw new Response("Not Found", { status: 404 });

  // 1. Resolve session → product_session metadata
  const { data: user_session, error: session_err } = await adminClient
    .from("nv2_sessions")
    .select(`
      product_session_id,
      nv2_product_sessions!inner(
        session_number,
        title,
        nv2_learning_products!inner(name)
      )
    `)
    .eq("session_id", sessionId)
    .single();

  if (session_err || !user_session) throw new Response("Not Found", { status: 404 });

  const ps = (user_session as any).nv2_product_sessions;
  const product_name: string = ps?.nv2_learning_products?.name ?? "";
  const session_number: number = ps?.session_number ?? 0;
  const session_title: string = ps?.title ?? `Session ${session_number}`;

  // 2. Fetch ordered learning stages for this product session
  const { data: pss_rows, error: pss_err } = await adminClient
    .from("nv2_product_session_stages")
    .select(`
      display_order,
      stage_id,
      nv2_stages!inner(id, title, stage_type, is_active)
    `)
    .eq("product_session_id", user_session.product_session_id)
    .order("display_order", { ascending: true });

  if (pss_err) throw pss_err;

  // Keep only learning stages
  const learning_stages = (pss_rows ?? [])
    .filter((r) => (r.nv2_stages as any)?.stage_type === "learning")
    .map((r) => ({ id: r.stage_id, title: (r.nv2_stages as any)?.title ?? "" }));

  if (learning_stages.length === 0) {
    return { product_name, session_number, session_title, rows: [] as PrintRow[] };
  }

  // 3. Fetch all active cards for these stages in one query
  const { data: cards_rows, error: cards_err } = await adminClient
    .from("nv2_cards")
    .select("stage_id, card_type, display_order, card_data")
    .in("stage_id", learning_stages.map((s) => s.id))
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (cards_err) throw cards_err;

  // 4. Group cards by stage_id
  type CardRow = { card_type: string; display_order: number; card_data: any };
  const cards_by_stage: Record<string, CardRow[]> = {};
  for (const row of cards_rows ?? []) {
    if (!cards_by_stage[row.stage_id]) cards_by_stage[row.stage_id] = [];
    cards_by_stage[row.stage_id].push({
      card_type: row.card_type,
      display_order: row.display_order,
      card_data: row.card_data as any,
    });
  }

  // 5. Build one print row per learning stage
  //    title card  → word / meaning / hint
  //    example card → sentence (presentation.front) / translation (presentation.back)
  const rows: PrintRow[] = [];
  let global_index = 1;

  for (let si = 0; si < learning_stages.length; si++) {
    const stage = learning_stages[si];
    const cards = cards_by_stage[stage.id] ?? [];

    const title_card   = cards.find((c) => c.card_type === "title");
    const example_card = cards.find((c) => c.card_type === "example");

    const word: string        = title_card?.card_data?.presentation?.front ?? stage.title;
    const meaning: string     = title_card?.card_data?.presentation?.back  ?? "";
    const hint: string | undefined = title_card?.card_data?.presentation?.hint || undefined;
    const sentence: string | undefined    = example_card?.card_data?.presentation?.front || undefined;
    const translation: string | undefined = example_card?.card_data?.presentation?.back  || undefined;

    rows.push({
      index: global_index++,
      is_first_in_stage: si === 0,
      word,
      meaning,
      hint,
      sentence,
      translation,
    });
  }

  return { product_name, session_number, session_title, rows };
}

// ---------------------------------------------------------------------------
// Helper — gap-fill
// ---------------------------------------------------------------------------

/**
 * Replaces the target word (or its inflected form) with a blank in a sentence.
 * Strategy:
 *   1. Exact whole-word match (case-insensitive)
 *   2. Stem match — first 60% of chars, minimum 4 (catches inflections)
 *   3. No match — return sentence unchanged (shown as plain example)
 */
function toGapFill(word: string, sentence: string): string {
  if (!word || !sentence) return sentence;

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const exact_re = new RegExp(`\\b${esc(word)}\\b`, "i");
  if (exact_re.test(sentence)) return sentence.replace(exact_re, "____________");

  const stem_len = Math.max(4, Math.floor(word.length * 0.6));
  const stem_re  = new RegExp(`\\b${esc(word.slice(0, stem_len))}\\S*`, "i");
  if (stem_re.test(sentence)) return sentence.replace(stem_re, "____________");

  return sentence;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PrintPage() {
  const { product_name, session_number, session_title, rows } =
    useLoaderData<typeof loader>();

  return (
    <>
      {/* ── Styles ── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
          font-size: 11px;
          color: #111;
          background: #fdf8f0;
        }

        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: #fdf8f0;
          padding: 14mm 14mm 10mm;
        }

        /* Header */
        .print-header {
          display: flex; align-items: baseline; justify-content: space-between;
          border-bottom: 2px solid #1a2744; padding-bottom: 6px; margin-bottom: 10px;
        }
        .print-header-left { display: flex; align-items: baseline; gap: 10px; }
        .print-title   { font-size: 16px; font-weight: 900; color: #1a2744; letter-spacing: -0.3px; }
        .print-subtitle{ font-size: 11px; color: #6b7a99; }
        .print-meta    { font-size: 10px; color: #9aa3b5; }

        /* Legend */
        .legend { display: flex; gap: 16px; margin-bottom: 8px; font-size: 9.5px; color: #6b7a99; }
        .legend-dot {
          display: inline-block; width: 8px; height: 8px;
          border-radius: 50%; margin-right: 4px; vertical-align: middle;
        }

        /* Table */
        .vocab-table {
          width: 100%; border-collapse: collapse; table-layout: fixed;
        }
        .vocab-table thead tr { background: #1a2744; color: white; }
        .vocab-table thead th {
          padding: 5px 8px; font-size: 9.5px; font-weight: 700;
          letter-spacing: 0.5px; text-align: left;
        }
        .col-num     { width: 26px; text-align: center !important; }
        .col-word    { width: 22%; }
        .col-meaning { width: 20%; }
        .col-sentence{ width: auto; }
        .col-write   { width: 15%; }

        .vocab-table tbody tr {
          border-bottom: 1px solid #e8ecf5;
          page-break-inside: avoid;
        }
        .vocab-table tbody tr:nth-child(even) { background: #f5f0e8; }
        .vocab-table tbody tr.stage-first td { border-top: 2px solid #4caf72; }

        .vocab-table td { padding: 6px 8px; vertical-align: top; line-height: 1.5; }

        .td-num { text-align: center; color: #9aa3b5; font-size: 9px; padding-top: 7px; }

        .word-main { font-size: 12px; font-weight: 800; color: #1a2744; letter-spacing: -0.2px; }
        .word-hint { font-size: 9px; color: #6b7a99; margin-top: 2px; display: block; }

        .meaning-text { font-size: 11px; color: #374151; }

        .sentence-text  { font-size: 10.5px; color: #374151; margin-bottom: 2px; }
        .translation-text { font-size: 9.5px; color: #9aa3b5; font-style: italic; }
        .gap-blank {
          color: #1a2744; border-bottom: 1.5px solid #1a2744;
          letter-spacing: 1.5px; font-weight: 700;
        }

        /* Writing lines */
        .write-lines { display: flex; flex-direction: column; gap: 7px; padding-top: 3px; }
        .write-line  { height: 14px; border-bottom: 1px solid #d1d5db; width: 100%; }

        /* Screen-only button bar */
        .btn-bar {
          position: fixed; top: 16px; right: 20px;
          display: flex; gap: 8px; z-index: 100;
        }
        .print-btn {
          padding: 8px 18px; background: #1a2744; color: white;
          border: none; border-radius: 8px; font-size: 13px;
          font-weight: 700; cursor: pointer;
        }
        .print-btn:hover { background: #243358; }
        .close-btn {
          padding: 8px 14px; background: white; color: #6b7a99;
          border: 1px solid #e8ecf5; border-radius: 8px;
          font-size: 13px; font-weight: 700; cursor: pointer;
        }

        /* Footer */
        .print-footer {
          margin-top: 16px; padding-top: 8px; border-top: 1px solid #e8ecf5;
          font-size: 9px; color: #c3c9d5; text-align: center;
        }

        /* Print media */
        @media print {
          .btn-bar { display: none !important; }
          body, .page { background: white; }
          .vocab-table tbody tr:nth-child(even) { background: #f9f9f9; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* Screen buttons */}
      <div className="btn-bar">
        <button className="print-btn" onClick={() => window.print()}>🖨️ 인쇄하기</button>
        <button className="close-btn" onClick={() => window.close()}>✕ 닫기</button>
      </div>

      {/* A4 page */}
      <div className="page">

        {/* Header */}
        <div className="print-header">
          <div className="print-header-left">
            <span className="print-title">{session_title}</span>
            <span className="print-subtitle">{product_name} · Session {session_number}</span>
          </div>
          <span className="print-meta">
            nudge.neowithai.com &nbsp;·&nbsp; {new Date().toLocaleDateString("ko-KR")}
          </span>
        </div>

        {/* Legend */}
        <div className="legend">
          <span><span className="legend-dot" style={{ background: "#4caf72" }} />초록 선 = 새 단어 시작</span>
          <span>💡 의미 열을 종이로 가리면 단어 → 의미 테스트</span>
          <span>✍️ 우측 칸에 단어를 3번 써보세요</span>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <p style={{ color: "#9aa3b5", padding: "20px 0" }}>
            이 세션에 학습 카드가 없습니다.
          </p>
        ) : (
          <table className="vocab-table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th className="col-word">단어</th>
                <th className="col-meaning">의미 ◀ 가리기</th>
                <th className="col-sentence">예문 / 빈칸 채우기</th>
                <th className="col-write">쓰기 ×3</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const gap = row.sentence ? toGapFill(row.word, row.sentence) : null;
                // gap === null  → no sentence
                // gap === sentence → word not found in sentence (show plain)
                // gap !== sentence → blank inserted
                const has_gap = gap !== null && gap !== row.sentence;

                return (
                  <tr
                    key={i}
                    className={row.is_first_in_stage && i > 0 ? "stage-first" : ""}
                  >
                    {/* # */}
                    <td className="td-num">{row.index}</td>

                    {/* 단어 */}
                    <td>
                      <div className="word-main">{row.word}</div>
                      {row.hint && <span className="word-hint">{row.hint}</span>}
                    </td>

                    {/* 의미 */}
                    <td>
                      <span className="meaning-text">{row.meaning}</span>
                    </td>

                    {/* 예문 */}
                    <td>
                      {has_gap ? (
                        <>
                          <div
                            className="sentence-text"
                            dangerouslySetInnerHTML={{
                              __html: gap!.replace(
                                /____________/g,
                                '<span class="gap-blank">____________</span>'
                              ),
                            }}
                          />
                          {row.translation && (
                            <div className="translation-text">{row.translation}</div>
                          )}
                        </>
                      ) : row.sentence ? (
                        <>
                          <div className="sentence-text">{row.sentence}</div>
                          {row.translation && (
                            <div className="translation-text">{row.translation}</div>
                          )}
                        </>
                      ) : null}
                    </td>

                    {/* 쓰기 */}
                    <td>
                      <div className="write-lines">
                        <div className="write-line" />
                        <div className="write-line" />
                        <div className="write-line" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Footer */}
        <div className="print-footer">
          Nudge · {product_name} · Session {session_number} · {session_title}
        </div>
      </div>
    </>
  );
}
