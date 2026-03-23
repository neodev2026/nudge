/**
 * [Lite Product Detail Page]
 * Displays detailed information about a product and its curriculum.
 * Includes a prominent CTA to connect SNS.
 */
import type { Route } from "./+types/product-detail-page";
import { useSearchParams, Link } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import { getLiteProductDetail, getLiteProductContents } from "../queries";


/**
 * Loader: Fetches product detail and curriculum contents based on ID.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const { id } = params;
  const [client] = makeServerClient(request);

  if (!id) throw new Error("Product ID is required");

  const [product, contents] = await Promise.all([
    getLiteProductDetail(client, id),
    getLiteProductContents(client, id),
  ]);

  const discordClientId =
    process.env.DISCORD_CLIENT_ID ?? process.env.DISCORD_OAUTH2_CLIENT_ID;
  const requestOrigin = new URL(request.url).origin;
  const discordRedirectUri =
    process.env.DISCORD_REDIRECT_URI ??
    process.env.DISCORD_OAUTH2_REDIRECT_URI ??
    new URL("/lite/auth/discord/callback", requestOrigin).toString();

  let discordAuthUrl: string | null = null;
  if (discordClientId) {
    const url = new URL("https://discord.com/api/oauth2/authorize");
    url.searchParams.set("client_id", discordClientId);
    url.searchParams.set("redirect_uri", discordRedirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", product.id);
    discordAuthUrl = url.toString();
  }

  return { product, contents, discordAuthUrl };
}

export default function LiteProductDetailPage({ loaderData }: Route.ComponentProps) {
  const { product, contents, discordAuthUrl } = loaderData;
  const [searchParams] = useSearchParams();
  const sns_id = searchParams.get("sns_id"); // Stateless persistence

  return (
    <div className="flex flex-col bg-white">
      {/* HERO SECTION: Product Overview */}
      <section className="bg-slate-900 px-6 py-20 text-white md:py-32">
        <div className="mx-auto max-w-4xl">
          <Link 
            to={`/lite${sns_id ? `?sns_id=${sns_id}` : ""}`}
            className="text-sm font-bold text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Courses
          </Link>
          <h1 className="mt-8 text-4xl font-black md:text-6xl">{product.name}</h1>
          <p className="mt-6 text-xl text-slate-300 leading-relaxed max-w-2xl">
            {product.description}
          </p>
        </div>
      </section>

      {/* CURRICULUM SECTION: List of contents */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-3xl font-black">Curriculum</h2>
          <div className="space-y-4">
            {contents.map((content, index) => (
              <div 
                key={content.id}
                className="flex items-start gap-6 rounded-2xl border-2 border-slate-100 p-6 transition-colors hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                  {(index + 1).toString().padStart(2, '0')}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{content.content_name}</h3>
                  <p className="mt-1 text-slate-500">{content.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STICKY CTA: Fixed at bottom for mobile, or section for desktop */}
      <section className="sticky bottom-0 border-t border-slate-200 bg-white/80 p-6 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="hidden md:block">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Ready to start?</p>
            <p className="text-lg font-black">No credit card required.</p>
          </div>
          {discordAuthUrl ? (
            <Link
              // Next step: Connect Discord with product information in URL
              to={discordAuthUrl}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-center text-lg font-black text-white shadow-lg transition-transform hover:scale-105 md:w-auto md:px-12"
            >
              Connect Discord & Start Learning
            </Link>
          ) : (
            <div
              className="w-full rounded-2xl bg-slate-200 py-4 text-center text-lg font-black text-slate-600 md:w-auto md:px-12"
              aria-disabled="true"
            >
              Connect Discord (configure env)
            </div>
          )}
        </div>
      </section>
    </div>
  );
}