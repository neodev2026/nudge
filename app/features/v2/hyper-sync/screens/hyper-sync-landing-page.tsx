/**
 * /hyper-sync — mission selection screen.
 *
 * Anonymous access allowed. The page does not require login; the anonymous_id
 * is created client-side on first visit (localStorage) and is sent with the
 * session results.
 */
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getHyperSyncProduct,
  getHyperSyncMissions,
} from "../lib/queries.server";
import { HyperSyncHeader } from "../components/hyper-sync-header";

const PRODUCT_SLUG = "developer-english";

export async function loader({ request }: LoaderFunctionArgs) {
  const [client] = makeServerClient(request);

  const {
    data: { user },
  } = await client.auth.getUser();

  const product = await getHyperSyncProduct(client as any, PRODUCT_SLUG);

  if (!product) {
    return { product: null, missions: [], isAuthenticated: !!user };
  }

  const missions = await getHyperSyncMissions(client as any, product.id);
  return {
    product: { id: product.id, name: product.name, slug: product.slug },
    missions,
    isAuthenticated: !!user,
  };
}

export const meta = () => [
  { title: "Hyper-Sync — 개발자 영어 3분 컷" },
  {
    name: "description",
    content:
      "GitHub PR, 기술 면접, 오픈소스 문서에서 자주 쓰는 표현을 3분 안에 점검하세요.",
  },
];

export default function HyperSyncLandingPage() {
  const { product, missions, isAuthenticated } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0]">
      <HyperSyncHeader subtitle="hyper-sync" isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-[680px] px-7 py-12">
        <h1 className="mb-2 font-mono text-2xl">미션을 선택하세요</h1>
        <p className="mb-10 text-sm text-white/60">
          각 미션은 3분 안에 완료됩니다
        </p>

        {!product ? (
          <EmptyState message="아직 콘텐츠가 준비되지 않았어요. 곧 공개됩니다." />
        ) : missions.length === 0 ? (
          <EmptyState message="활성화된 미션이 없습니다. 곧 추가됩니다." />
        ) : (
          <ul className="flex flex-col gap-3">
            {missions.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#111111] px-6 py-5 transition hover:border-white/20"
              >
                <div className="flex-1">
                  <div className="mb-2 text-[15px] font-normal">{m.title}</div>
                  <div className="flex gap-2">
                    <Tag>{m.stageCount}개</Tag>
                    <Tag dim>~3분</Tag>
                  </div>
                </div>
                <Link
                  to={`/hyper-sync/session?productId=${product.id}&sessionId=${m.id}`}
                  className="whitespace-nowrap rounded-lg bg-[#c8f564] px-5 py-2.5 font-mono text-xs font-bold tracking-wider text-[#0a0a0a] transition hover:opacity-90"
                >
                  시작하기 →
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/10 bg-[#111111] px-5 py-4 text-xs leading-relaxed text-white/60">
          <span className="shrink-0 text-xl">💬</span>
          <span>
            로그인하면 틀린 표현을 다음날 아침 Discord DM으로 받아볼 수 있어요.
            미션은 로그인 없이도 가능합니다.
          </span>
        </div>
      </main>
    </div>
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
