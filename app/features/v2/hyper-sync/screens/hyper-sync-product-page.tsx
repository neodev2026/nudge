/**
 * /hyper-sync/products/:slug — mission list for one Hyper-Sync product.
 *
 * Reached from the /hyper-sync landing page after the visitor picks a
 * product. Lists that product's active missions. For a logged-in user,
 * missions already played (any nv2_hyper_sync_results row exists) get a
 * "진행함" badge — see hyper-sync-spec §5.1.
 *
 * Anonymous access is allowed; anonymous play history lives in a
 * localStorage 'anon:' id the server loader cannot read, so anonymous
 * visitors simply see no progress badges.
 *
 * An unknown or non-enrolled slug redirects back to /hyper-sync.
 */
import { Link, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getHyperSyncMissions,
  getHyperSyncProduct,
  getPlayedMissionIds,
  type HyperSyncMission,
} from "../lib/queries.server";
import { getProductSubtitle, isHyperSyncProductSlug } from "../lib/products";
import { HyperSyncHeader } from "../components/hyper-sync-header";

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Only products explicitly enrolled in Hyper-Sync are reachable here.
  if (!isHyperSyncProductSlug(params.slug)) {
    throw redirect("/hyper-sync");
  }

  const [client] = makeServerClient(request);

  const {
    data: { user },
  } = await client.auth.getUser();

  const product = await getHyperSyncProduct(client as any, params.slug);
  if (!product) throw redirect("/hyper-sync");

  const missions = await getHyperSyncMissions(client as any, product.id);

  // Progress badges are shown for logged-in users only (see file header).
  const playedIds = user
    ? await getPlayedMissionIds(client as any, user.id, product.id)
    : new Set<string>();

  return {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description ?? null,
      subtitle: getProductSubtitle(product.category, product.meta),
    },
    missions,
    playedMissionIds: Array.from(playedIds),
    isAuthenticated: !!user,
  };
}

export function meta({
  data,
}: {
  data: { product: { name: string } } | undefined;
}) {
  return [
    {
      title: data?.product
        ? `${data.product.name} — Hyper-Sync 미션`
        : "Hyper-Sync 미션",
    },
  ];
}

export default function HyperSyncProductPage() {
  const { product, missions, playedMissionIds, isAuthenticated } =
    useLoaderData<typeof loader>();

  const playedSet = new Set(playedMissionIds);
  const hasDescription =
    typeof product.description === "string" &&
    product.description.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0]">
      <HyperSyncHeader subtitle="hyper-sync" isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-[680px] px-7 py-12">
        <Link
          to="/hyper-sync"
          className="mb-6 inline-block font-mono text-xs text-white/50 transition hover:text-white"
        >
          ← 미션 상품
        </Link>

        <div className="mb-2 flex items-end justify-between gap-3">
          <h1 className="font-mono text-2xl">{product.name}</h1>
          {product.subtitle && (
            <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-white/40">
              {product.subtitle}
            </span>
          )}
        </div>

        {/* Product description — hidden entirely when the product has none. */}
        {hasDescription && (
          <p className="mb-2 text-sm leading-relaxed text-white/70">
            {product.description}
          </p>
        )}

        <p className="mb-8 text-sm text-white/60">
          각 미션은 3분 안에 완료됩니다
        </p>

        {missions.length === 0 ? (
          <EmptyState message="활성화된 미션이 없습니다." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {missions.map((m) => (
              <MissionRow
                key={m.id}
                mission={m}
                productId={product.id}
                played={isAuthenticated && playedSet.has(m.id)}
              />
            ))}
          </ul>
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

function MissionRow({
  mission,
  productId,
  played,
}: {
  mission: HyperSyncMission;
  productId: string;
  played: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#111111] px-5 py-4 transition hover:border-white/20">
      <div className="flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[14px] font-normal">{mission.title}</span>
          {played && (
            <span className="inline-block rounded bg-[#c8f564]/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-[#c8f564]">
              ✓ 진행함
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Tag>{mission.stageCount}개</Tag>
          <Tag dim>~3분</Tag>
        </div>
      </div>
      <Link
        to={`/hyper-sync/session?productId=${productId}&sessionId=${mission.id}`}
        className="whitespace-nowrap rounded-lg bg-[#c8f564] px-4 py-2 font-mono text-xs font-bold tracking-wider text-[#0a0a0a] transition hover:opacity-90"
      >
        시작하기 →
      </Link>
    </li>
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
