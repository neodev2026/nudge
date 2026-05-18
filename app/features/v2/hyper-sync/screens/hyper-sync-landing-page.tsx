/**
 * /hyper-sync — mission selection screen.
 *
 * Anonymous access allowed. The page does not require login; the anonymous_id
 * is created client-side on first visit (localStorage) and is sent with the
 * session results.
 *
 * Multiple products participate in Hyper-Sync. Each one renders as its own
 * info box containing that product's active missions. The valid product
 * slugs are listed in HYPER_SYNC_PRODUCT_SLUGS — the session page validates
 * inbound productId against this list before loading cards.
 */
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getHyperSyncMissions,
  getHyperSyncProduct,
  type HyperSyncMission,
} from "../lib/queries.server";
import { HYPER_SYNC_PRODUCT_SLUGS } from "../lib/products";
import { HyperSyncHeader } from "../components/hyper-sync-header";

interface ProductBoxData {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  missions: HyperSyncMission[];
}

function getProductSubtitle(
  category: string | null | undefined,
  meta: unknown
): string {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";
  const m = meta as Record<string, unknown>;
  if (category === "language") {
    const lang = typeof m.language === "string" ? m.language.toUpperCase() : "";
    const level = typeof m.level === "string" ? m.level : "";
    return [lang, level].filter(Boolean).join(" · ");
  }
  return "";
}

export async function loader({ request }: LoaderFunctionArgs) {
  const [client] = makeServerClient(request);

  const {
    data: { user },
  } = await client.auth.getUser();

  const productBoxes: ProductBoxData[] = [];

  // Fetch all hyper-sync products + missions in parallel.
  const productResults = await Promise.all(
    HYPER_SYNC_PRODUCT_SLUGS.map(async (slug) => {
      const product = await getHyperSyncProduct(client as any, slug);
      if (!product) return null;
      const missions = await getHyperSyncMissions(client as any, product.id);
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        subtitle: getProductSubtitle(product.category, product.meta),
        missions,
      };
    })
  );

  for (const box of productResults) {
    if (box) productBoxes.push(box);
  }

  return {
    productBoxes,
    isAuthenticated: !!user,
  };
}

export const meta = () => [
  { title: "Hyper-Sync — 고속 암기 + 복습으로 기억 유지" },
  {
    name: "description",
    content:
      "기술 영어와 독일어 표현을 3분 안에 점검하고 망각 곡선 기반 복습으로 기억을 굳혀보세요.",
  },
];

export default function HyperSyncLandingPage() {
  const { productBoxes, isAuthenticated } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0]">
      <HyperSyncHeader subtitle="hyper-sync" isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-[680px] px-7 py-12">
        <h1 className="mb-2 font-mono text-2xl">미션을 선택하세요</h1>
        <p className="mb-10 text-sm text-white/60">
          각 미션은 3분 안에 완료됩니다
        </p>

        {productBoxes.length === 0 ? (
          <EmptyState message="아직 콘텐츠가 준비되지 않았어요. 곧 공개됩니다." />
        ) : (
          <div className="flex flex-col gap-8">
            {productBoxes.map((box) => (
              <ProductBox key={box.id} box={box} />
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center gap-3 rounded-xl border border-white/10 bg-[#111111] px-5 py-4 text-xs leading-relaxed text-white/60">
          <span className="shrink-0 text-xl">💬</span>
          <span>
            로그인하면 틀린 표현을 다음 날 아침 Discord DM(또는 이메일)으로 받을
            수 있어요. 미션은 로그인 없이도 가능합니다.
          </span>
        </div>
      </main>
    </div>
  );
}

function ProductBox({ box }: { box: ProductBoxData }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0e0e0e] p-5">
      <header className="mb-4 flex items-end justify-between gap-3 border-b border-white/10 pb-3">
        <h2 className="text-base font-medium text-white/90">{box.name}</h2>
        {box.subtitle && (
          <span className="font-mono text-[10px] tracking-[0.08em] text-white/40">
            {box.subtitle}
          </span>
        )}
      </header>

      {box.missions.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-white/40">
          활성화된 미션이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {box.missions.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#111111] px-5 py-4 transition hover:border-white/20"
            >
              <div className="flex-1">
                <div className="mb-1.5 text-[14px] font-normal">{m.title}</div>
                <div className="flex gap-2">
                  <Tag>{m.stageCount}개</Tag>
                  <Tag dim>~3분</Tag>
                </div>
              </div>
              <Link
                to={`/hyper-sync/session?productId=${box.id}&sessionId=${m.id}`}
                className="whitespace-nowrap rounded-lg bg-[#c8f564] px-4 py-2 font-mono text-xs font-bold tracking-wider text-[#0a0a0a] transition hover:opacity-90"
              >
                시작하기 →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Tag({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span
      className={
        "inline-block rounded px-2 py-0.5 font-mono text-[10px] tracking-wider " +
        (dim
          ? "border border-white/10 bg-[#1a1a1a] text-white/60"
          : "border border-[#c8f564]/30 bg-[#c8f564]/10 text-[#c8f564]")
      }
    >
      {children}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-[#111111] px-6 py-16 text-center">
      <span className="text-3xl">📦</span>
      <p className="text-sm text-white/60">{message}</p>
    </div>
  );
}
