/**
 * [Lite Home Page]
 * Implemented using Supabase Client and dedicated query layer.
 * Design inspired by Brilliant.org (High-contrast, section-based).
 */
import type { Route } from "./+types/home-page";
import { Link, useLoaderData, useSearchParams } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import { getLiteActiveProducts } from "../queries";

/**
 * Loader: Uses makeServerClient and calls getLiteActiveProducts helper.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const products = await getLiteActiveProducts(client);

  return { products };
}

export default function LiteHomePage({ loaderData }: Route.ComponentProps) {
  const { products } = loaderData;
  const [searchParams] = useSearchParams();
  const sns_id = searchParams.get("sns_id"); // Stateless: persistent URL param

  return (
    <div className="flex flex-col bg-white font-sans text-slate-900">
      {/* SECTION 1: HERO - Brilliant-style headline */}
      <section className="px-6 py-24 text-center md:py-36">
        <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight md:text-8xl">
          Master languages <br />
          <span className="text-emerald-500 italic">one nudge</span> at a time.
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-lg text-slate-500 md:text-xl">
          Connect your SNS and start learning. No signup required. 
          The smartest way to learn on the go.
        </p>
      </section>

      {/* SECTION 2: EXHIBITION - Vertical product list */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Choose Your Course</h2>
          <div className="flex flex-col gap-6">
            {products.map((product) => (
              <Link
                key={product.id}
                // Maintain sns_id in URL to keep the stateless architecture
                to={`/lite/products/${product.id}${sns_id ? `?sns_id=${sns_id}` : ""}`}
                className="group flex flex-col items-center overflow-hidden rounded-[2.5rem] border-2 border-slate-200 bg-white p-2 transition-all hover:border-emerald-500 hover:shadow-2xl md:flex-row"
              >
                {/* Visual Placeholder for Product */}
                <div className="h-48 w-full shrink-0 rounded-[2rem] bg-slate-100 transition-colors group-hover:bg-emerald-50 md:h-56 md:w-56" />
                
                <div className="flex flex-1 flex-col p-8">
                  <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">Interactive Course</span>
                  <h3 className="mt-2 text-2xl font-black group-hover:text-emerald-600">{product.name}</h3>
                  <p className="mt-3 text-slate-500 line-clamp-2">{product.description}</p>
                  
                  <div className="mt-6 flex items-center gap-2 font-bold text-slate-900">
                    Get Started 
                    <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      
      {/* Additional sections can be added here for 'How it works' etc. */}
    </div>
  );
}