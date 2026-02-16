import { data, redirect, Form } from "react-router";
import { z } from "zod";
import { 
  CheckIcon, 
  ZapIcon, 
  CrownIcon, 
  RocketIcon, 
  AlertCircleIcon,
  ChevronRightIcon,
  PartyPopperIcon
} from "lucide-react";

/**
 * Server-side utilities and queries
 */
import makeServerClient from "~/core/lib/supa-client.server";
import { getProductById } from "../queries";
import { getUserSnsConnections } from "~/features/user-sns-connection/queries";
import { subscribeAndInitializeAction } from "~/features/user-product-subscription/lib/services.server";

/**
 * Common UI components
 */
import { Hero } from "~/core/components/hero";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "~/core/components/ui/card";
import { Button } from "~/core/components/ui/button";
import { Badge } from "~/core/components/ui/badge";

import type { Route } from "./+types/product-detail-page";

/**
 * Zod schema for parameter validation
 */
const paramsSchema = z.object({
  productId: z.string().uuid("Invalid product ID format."),
});

/**
 * Dynamic Page Metadata
 */
export const meta = ({ data }: Route.MetaArgs) => {
  return [
    { title: `${data?.product?.name || "Product"} | Nudge` },
    { name: "description", content: data?.product?.description || "Product details" },
  ];
};

/**
 * Server-Side Loader: Fetches product details and validates user SNS/Subscription status
 */
export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { data: parsed, success } = paramsSchema.safeParse(params);
  if (!success) throw new Response("Not Found", { status: 404 });

  const [client, headers] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();
  
  /**
   * Fetch data in parallel: Product, SNS Connections, and existing Subscription
   */
  const [product, snsConnections, subscriptionResult] = await Promise.all([
    getProductById(client, { productId: parsed.productId }),
    user ? getUserSnsConnections(client, { userId: user.id }) : Promise.resolve([]),
    user 
      ? client
          .from("user_product_subscription")
          .select("id, is_active")
          .eq("user_id", user.id)
          .eq("learning_product_id", parsed.productId)
          .maybeSingle() 
      : Promise.resolve({ data: null }),
  ]);

  if (!product) throw new Response("Product Not Found", { status: 404 });

  const isVerified = snsConnections.some(c => c.is_active && c.verified_at);
  const isSubscribed = subscriptionResult.data?.is_active ?? false;

  return data({ 
    product, 
    isSnsConnected: isVerified,
    isLoggedIn: !!user,
    isSubscribed // Added subscription status
  }, { headers });
};

/**
 * Action: Handles subscription logic and initializes learning progress
 */
export const action = async ({ request, params }: Route.ActionArgs) => {
  const [client, headers] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();
  const formData = await request.formData();
  
  const tier = formData.get("tier") as "basic" | "premium" | "vip";

  if (!user) return redirect("/auth/login", { headers });

  const snsConnections = await getUserSnsConnections(client, { userId: user.id });
  const validConnections = snsConnections.filter(c => c.is_active && c.verified_at);
  
  if (validConnections.length === 0) {
    return redirect("/my/settings/sns?error=sns_required", { headers });
  }

  const targetSns = validConnections.find(c => c.is_primary) || validConnections[0];

  try {
    /**
     * Executes subscription and engine initialization in a single transaction
     */
    await subscribeAndInitializeAction(user.id, params.productId!, targetSns.id, tier);

    /**
     * [UPDATE] Refresh the current page
     * Redirecting back to request.url triggers loader revalidation, 
     * which will now find the new subscription and show the 'Already Subscribed' UI.
     */
    return redirect(request.url, { headers });
  } catch (error) {
    console.error("Subscription Initialization Error:", error);
    throw new Response("Failed to initialize your learning journey", { status: 500 });
  }
};

export default function ProductDetailPage({ loaderData }: Route.ComponentProps) {
  const { product, isSnsConnected, isSubscribed } = loaderData;

  const tiers = [
    {
      id: "basic",
      name: "Basic",
      price: "Free",
      description: "Nudges every 2 hours",
      features: ["SM-2 SRS Engine", "All 9 card types", "Basic stats"],
      icon: <RocketIcon className="size-5" />,
      highlight: false,
    },
    {
      id: "premium",
      name: "Premium",
      price: "₩3,900",
      description: "Fast nudges every 5 minutes",
      features: ["High-speed intervals", "Premium UI Theme", "PDF Learning Reports"],
      icon: <ZapIcon className="size-5 text-yellow-500" />,
      highlight: true,
    },
    {
      id: "vip",
      name: "VIP",
      price: "₩8,900",
      description: "Instant AI Personalization",
      features: ["Unlimited instant nudges", "AI Custom Example Generation", "Priority Support"],
      icon: <CrownIcon className="size-5 text-purple-500" />,
      highlight: false,
    },
  ];

  return (
    <div className="space-y-16 pb-24 font-bold">
      <Hero title={product.name} subtitle={product.description || ''} />

      <div className="container mx-auto max-w-screen-xl px-4 space-y-16">
        
        {/* Conditional Rendering: Already Subscribed vs Pricing Tiers */}
        {isSubscribed ? (
          <div className="max-w-2xl mx-auto">
            <Card className="border-4 border-primary rounded-[3rem] overflow-hidden shadow-2xl">
              <CardContent className="p-12 text-center space-y-6">
                <div className="mx-auto size-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <PartyPopperIcon className="size-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">Already Subscribed!</h3>
                  <p className="text-muted-foreground font-medium">
                    You are already learning with this product. Keep up the great work!
                  </p>
                </div>
                <Button asChild className="hidden w-full h-16 rounded-full font-black uppercase text-sm tracking-widest shadow-xl">
                  <a href="/my/dashboard">
                    Go to My Dashboard <ChevronRightIcon className="size-5 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {tiers.map((tier) => (
              <Card 
                key={tier.id} 
                className={`border-4 rounded-[2.5rem] flex flex-col transition-all ${
                  tier.highlight ? 'border-primary shadow-2xl scale-105' : 'border-muted'
                }`}
              >
                <CardHeader className="p-8 pb-4 text-center space-y-3">
                  <div className="mx-auto size-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                    {tier.icon}
                  </div>
                  <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">
                    {tier.name}
                  </CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-black text-primary">{tier.price}</span>
                    {tier.id !== 'basic' && <span className="text-xs text-muted-foreground">/mo</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                    {tier.description}
                  </p>
                </CardHeader>
                
                <CardContent className="p-8 flex-1">
                  <ul className="space-y-4">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm">
                        <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <CheckIcon className="size-3 text-primary" />
                        </div>
                        <span className="font-medium text-foreground/80">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="p-8 pt-0">
                  <Form method="post" className="w-full">
                    <input type="hidden" name="tier" value={tier.id} />
                    <Button 
                      type="submit"
                      variant={tier.highlight ? "default" : "outline"} 
                      className={`w-full h-14 rounded-full font-black uppercase text-xs tracking-widest shadow-lg ${
                        !isSnsConnected && "opacity-80"
                      }`}
                    >
                      {isSnsConnected ? "Start Learning" : "Connect SNS to Start"}
                    </Button>
                  </Form>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* SNS Connection Nudge (Only shown if not subscribed) */}
        {!isSubscribed && !isSnsConnected && (
          <div className="bg-destructive/5 border-2 border-dashed border-destructive/20 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-left">
              <div className="p-4 bg-destructive/10 rounded-2xl">
                <AlertCircleIcon className="size-8 text-destructive" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black tracking-tight text-destructive italic">Connection Required</h4>
                <p className="text-sm text-muted-foreground font-medium">
                  To receive Nudge cards, you must link and verify your Discord account first.
                </p>
              </div>
            </div>
            <Button variant="destructive" asChild className="rounded-full px-8 font-black text-xs uppercase shadow-xl">
              <a href="/my/settings/sns">
                Go to Settings <ChevronRightIcon className="size-4 ml-2" />
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}