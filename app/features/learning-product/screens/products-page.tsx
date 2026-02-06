import { data } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import { getLearningProducts } from "../queries";
import { Hero } from "~/core/components/hero";
import { ProductCard } from "../components/product-card";
import type { Route } from "./+types/products-page";

/**
 * Set metadata
 */
export const meta = () => {
  return [
    { title: "Browse Products | Nudge" },
    { name: "description", content: "바쁜 현대인을 위한 무지성 암기 제품을 만나보세요." },
  ];
};

/**
 * Server-side loader
 * Fetches product list from DB while maintaining valid session
 */
export const loader = async ({ request }: Route.LoaderArgs) => {
  const [client, headers] = makeServerClient(request);
  
  const products = await getLearningProducts(client);
  
  return data({ products }, { headers });
};

export default function ProductsPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-12 pb-20">
      {/* 서비스 아이덴티티를 담은 히어로 섹션 */}
      <Hero
        title="Learning Products"
        subtitle="원하는 언어와 테마를 선택하고 SNS로 무지성 암기를 시작하세요."
      />

      {/* 제품 리스트 그리드 */}
      <div className="container mx-auto max-w-screen-xl px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loaderData.products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              description={product.description || ''}
              // Nudge 전용 추가 정보 (언어, 난이도 등)
            //  tagline={`${product.target_language} ${product.level}`}
            //   votesCount={product.subscriber_count} // 구독자 수 등을 투표수로 치환하여 표현 가능
              isUpvoted={false}
            //   promotedFrom={null}
            />
          ))}
        </div>
        
        {/* 제품이 없을 경우의 예외 처리 */}
        {loaderData.products.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed rounded-3xl">
            <p className="text-muted-foreground font-bold">등록된 학습 제품이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}