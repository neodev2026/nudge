/**
 * /products/:slug/marathon/print
 *
 * A4 print sheet for all learning stages across a product.
 * Layout: # | word | meaning (coverable) | example sentence | write ×3
 *
 * No auth required — same public access as session print.
 * Opens in a new tab via target="_blank" from the marathon entry page.
 */
import { createClient } from "@supabase/supabase-js";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import type { Database } from "database.types";
import { getMarathonStages } from "~/features/v2/marathon/lib/queries.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrintRow {
  index: number;
  stage_number: number;
  word: string;
  meaning: string;
  hint?: string;
  sentence?: string;
  translation?: string;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }: LoaderFunctionArgs) {
  const { slug } = params;
  if (!slug) throw new Response("Not Found", { status: 404 });

  const adminClient = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: product, error: prod_err } = await adminClient
    .from("nv2_learning_products")
    .select("id, name")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (prod_err || !product) throw new Response("Not Found", { status: 404 });

  // Use nested select (stages + cards in one request) to avoid large .in() URL
  const stages = await getMarathonStages(adminClient, product.id);

  let global_index = 1;
  const rows: PrintRow[] = stages.map((stage) => {
    const title_card = stage.cards.find((c) => c.card_type === "title");
    const example_card = stage.cards.find((c) => c.card_type === "example");
    return {
      index: global_index++,
      stage_number: stage.stage_number,
      word: title_card?.card_data?.presentation?.front ?? stage.title,
      meaning: title_card?.card_data?.presentation?.back ?? "",
      hint: title_card?.card_data?.presentation?.hint || undefined,
      sentence: example_card?.card_data?.presentation?.front || undefined,
      translation: example_card?.card_data?.presentation?.back || undefined,
    };
  });

  return {
    product_name: product.name,
    rows,
    print_date: new Date().toLocaleDateString("ko-KR"),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
    font-size: 11px;
    color: #111;
    background: #fdf8f0;
  }

  .mprint-page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #fdf8f0;
    padding: 14mm 14mm 10mm;
  }

  .mprint-header {
    display: flex; align-items: baseline; justify-content: space-between;
    border-bottom: 2px solid #1a2744; padding-bottom: 6px; margin-bottom: 10px;
  }
  .mprint-header-left { display: flex; align-items: baseline; gap: 10px; }
  .mprint-title   { font-size: 16px; font-weight: 900; color: #1a2744; letter-spacing: -0.3px; }
  .mprint-subtitle{ font-size: 11px; color: #6b7a99; }
  .mprint-meta    { font-size: 10px; color: #9aa3b5; }

  .mprint-legend { display: flex; gap: 16px; margin-bottom: 8px; font-size: 9.5px; color: #6b7a99; }

  .mprint-table { width: 100%; border-collapse: collapse; table-layout: fixed; }

  .mprint-table thead tr { background: #1a2744; color: white; }
  .mprint-table thead th {
    padding: 5px 8px; font-size: 9.5px; font-weight: 700;
    letter-spacing: 0.5px; text-align: left;
  }
  .mprint-col-num     { width: 26px; text-align: center !important; }
  .mprint-col-word    { width: 22%; }
  .mprint-col-meaning { width: 20%; }
  .mprint-col-write   { width: 15%; }

  .mprint-table tbody tr {
    border-bottom: 1px solid #e8ecf5;
    page-break-inside: avoid;
  }
  .mprint-table tbody tr:nth-child(even) { background: #f5f0e8; }

  .mprint-table td { padding: 6px 8px; vertical-align: top; line-height: 1.5; }

  .mprint-td-num { text-align: center; color: #9aa3b5; font-size: 9px; padding-top: 7px; }

  .mprint-word-main { font-size: 12px; font-weight: 800; color: #1a2744; letter-spacing: -0.2px; }
  .mprint-word-hint { font-size: 9px; color: #6b7a99; margin-top: 2px; display: block; }

  .mprint-meaning { font-size: 11px; color: #374151; }

  .mprint-sentence    { font-size: 10.5px; color: #374151; margin-bottom: 2px; }
  .mprint-translation { font-size: 9.5px; color: #9aa3b5; font-style: italic; }

  .mprint-write-lines { display: flex; flex-direction: column; gap: 7px; padding-top: 3px; }
  .mprint-write-line  { height: 14px; border-bottom: 1px solid #d1d5db; width: 100%; }

  .mprint-btn-bar {
    position: fixed; top: 16px; right: 20px;
    display: flex; gap: 8px; z-index: 100;
  }
  .mprint-print-btn {
    padding: 8px 18px; background: #1a2744; color: white;
    border: none; border-radius: 8px; font-size: 13px;
    font-weight: 700; cursor: pointer;
  }
  .mprint-print-btn:hover { background: #243358; }
  .mprint-close-btn {
    padding: 8px 14px; background: white; color: #6b7a99;
    border: 1px solid #e8ecf5; border-radius: 8px;
    font-size: 13px; font-weight: 700; cursor: pointer;
  }

  .mprint-footer {
    margin-top: 16px; padding-top: 8px; border-top: 1px solid #e8ecf5;
    font-size: 9px; color: #c3c9d5; text-align: center;
  }

  @media print {
    .mprint-btn-bar { display: none !important; }
    body, .mprint-page { background: white; }
    .mprint-table tbody tr:nth-child(even) { background: #f9f9f9; }
    @page { size: A4; margin: 0; }
  }
`;

export default function MarathonPrintPage() {
  const { product_name, rows, print_date } = useLoaderData<typeof loader>();

  return (
    <>
      {/* dangerouslySetInnerHTML prevents React 19 from hoisting this to <head> */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="mprint-btn-bar">
        <button className="mprint-print-btn" onClick={() => window.print()}>🖨️ 인쇄하기</button>
        <button className="mprint-close-btn" onClick={() => window.close()}>✕ 닫기</button>
      </div>

      <div className="mprint-page">

        <div className="mprint-header">
          <div className="mprint-header-left">
            <span className="mprint-title">{product_name} — 전체 단어장</span>
            <span className="mprint-subtitle">마라톤 모드 · {rows.length}개 단어</span>
          </div>
          <span className="mprint-meta">
            nudge.neowithai.com &nbsp;·&nbsp; {print_date}
          </span>
        </div>

        <div className="mprint-legend">
          <span>💡 의미 열을 종이로 가리면 단어 → 의미 테스트</span>
          <span>✍️ 우측 칸에 단어를 3번 써보세요</span>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: "#9aa3b5", padding: "20px 0" }}>
            이 상품에 학습 카드가 없습니다.
          </p>
        ) : (
          <table className="mprint-table">
            <thead>
              <tr>
                <th className="mprint-col-num">#</th>
                <th className="mprint-col-word">단어</th>
                <th className="mprint-col-meaning">의미 ◀ 가리기</th>
                <th>예문</th>
                <th className="mprint-col-write">쓰기 ×3</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="mprint-td-num">{row.index}</td>
                  <td>
                    <div className="mprint-word-main">{row.word}</div>
                    {row.hint && <span className="mprint-word-hint">{row.hint}</span>}
                  </td>
                  <td>
                    <span className="mprint-meaning">{row.meaning}</span>
                  </td>
                  <td>
                    {row.sentence && (
                      <>
                        <div className="mprint-sentence">{row.sentence}</div>
                        {row.translation && (
                          <div className="mprint-translation">{row.translation}</div>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <div className="mprint-write-lines">
                      <div className="mprint-write-line" />
                      <div className="mprint-write-line" />
                      <div className="mprint-write-line" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mprint-footer">
          Nudge · {product_name} · 전체 {rows.length}개 단어
        </div>
      </div>
    </>
  );
}
