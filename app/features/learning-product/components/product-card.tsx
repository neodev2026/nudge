import { Link } from "react-router";
import { Card, CardContent, CardFooter } from "~/core/components/ui/card";
import { Badge } from "~/core/components/ui/badge";
import { MessageCircleIcon, EyeIcon, ArrowBigUpIcon, GlobeIcon } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  tagline?: string;
  reviewsCount?: number;
  viewsCount?: number;
  votesCount?: number;
  isUpvoted?: boolean;
}

export function ProductCard({
  id,
  name,
  description,
  tagline,
  votesCount = 0,
  viewsCount = 0,
}: ProductCardProps) {
  return (
    <Link to={`/products/${id}`} className="group block transition-transform hover:-translate-y-1">
      <Card className="border-2 shadow-none rounded-[2rem] overflow-hidden group-hover:border-primary/50 transition-colors">
        <CardContent className="p-8 space-y-4">
          <div className="flex justify-between items-start">
            <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors">
              {name}
            </h3>
            {tagline && (
              <Badge variant="secondary" className="font-mono text-[10px] uppercase border-2">
                <GlobeIcon className="size-3 mr-1" /> {tagline}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground font-medium line-clamp-2 leading-relaxed">
            {description}
          </p>
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/20 border-t flex items-center gap-6">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <ArrowBigUpIcon className="size-4" /> {votesCount}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <EyeIcon className="size-4" /> {viewsCount}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}