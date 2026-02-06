import { data } from "react-router";
import { z } from "zod";
import makeServerClient from "~/core/lib/supa-client.server";
import { getProductById } from "../queries";
import { Hero } from "~/core/components/hero";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "~/core/components/ui/card";
import { Button } from "~/core/components/ui/button";
import { Badge } from "~/core/components/ui/badge";
import { CheckIcon, ZapIcon, CrownIcon, RocketIcon } from "lucide-react";
import type { Route } from "./+types/product-detail-page";

/**
 * parameter validation schema
 */
const paramsSchema = z.object({
  productId: z.string().uuid(),
});

export const meta = ({ data }: Route.MetaArgs) => {
  return [
    { title: `${data?.product?.name || "Product"} | Nudge` },
    { name: "description", content: data?.product?.description },
  ];
};

/**
 * server-side loader
 */
export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { data: parsed, success } = paramsSchema.safeParse(params);
  if (!success) throw new Response("Invalid Product ID", { status: 400 });

  const [client, headers] = makeServerClient(request);
  const product = await getProductById(client, { productId: parsed.productId });

  return data({ product }, { headers });
};

export default function ProductDetailPage({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;

  const tiers = [
    {
      id: "basic",
      name: "Basic",
      price: "Free",
      description: "무료로 시작하는 무지성 암기",
      features: ["2시간마다 Nudge 발송", "공유 카드 라이브러리", "기본 학습 통계"],
      icon: <RocketIcon className="size-5" />,
      buttonVariant: "outline" as const,
    },
    {
      id: "premium",
      name: "Premium",
      price: "₩3,900 / mo",
      description: "바쁜 분들을 위한 빠른 회독",
      features: ["5분마다 Nudge 발송", "VIP 전용 알림 인터벌", "상세 학습 리포트"],
      icon: <ZapIcon className="size-5 text-yellow-500" />,
      buttonVariant: "default" as const,
    },
    {
      id: "vip",
      name: "VIP",
      price: "₩8,900 / mo",
      description: "AI 개인화의 끝판왕",
      features: ["즉시 무제한 Nudge", "AI 개인화 커스텀 카드", "우선 순위 지원"],
      icon: <CrownIcon className="size-5 text-purple-500" />,
      buttonVariant: "default" as const,
    },
  ];

  return (
    <div className="space-y-16 pb-20 font-bold">
      <Hero title={product.name} subtitle={product.description || ''} />

      <div className="container mx-auto max-w-screen-xl px-4 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <Card key={tier.id} className={`border-4 rounded-[2.5rem] flex flex-col ${tier.id === 'premium' ? 'border-primary shadow-xl scale-105' : 'border-muted'}`}>
              <CardHeader className="p-8 pb-4 text-center space-y-2">
                <div className="mx-auto size-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                  {tier.icon}
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter italic">{tier.name}</CardTitle>
                <div className="text-3xl font-black text-primary">{tier.price}</div>
                <p className="text-xs text-muted-foreground font-medium">{tier.description}</p>
              </CardHeader>
              
              <CardContent className="p-8 flex-1">
                <ul className="space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <CheckIcon className="size-3 text-primary" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="p-8 pt-0">
                <Button variant={tier.buttonVariant} className="w-full h-12 rounded-full font-black uppercase text-xs tracking-widest shadow-lg">
                  구독하기
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        {/* 제품 추가 정보 섹션 */}
        <div className="bg-muted/10 border-2 border-dashed rounded-[3rem] p-12 text-center space-y-4">
          <Badge className="px-4 py-1 text-[10px] uppercase font-black tracking-tighter">Product Info</Badge>
          {/* <h2 className="text-2xl font-black">이 단어장은 {product.target_language?} {product.level} 수준입니다.</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Nudge는 여러분의 모국어({product.learner_language})를 기반으로 가장 효율적인 암기 경로를 생성합니다. 
            지금 바로 SNS를 연결하고 학습을 시작하세요.
          </p> */}
        </div>
      </div>
    </div>
  );
}