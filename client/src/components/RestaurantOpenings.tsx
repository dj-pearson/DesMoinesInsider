import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OPENING_STATUS_META } from "@shared/openingStatus";
import type { OpeningStatus, RestaurantOpening } from "@shared/schema";

/**
 * Compact home-page strip. The full tracker, with tabs and a map, lives at
 * /openings; this is a teaser that links there.
 */
export function RestaurantOpenings() {
  const { data: openings = [], isLoading } = useQuery<RestaurantOpening[]>({
    queryKey: ["/api/restaurant-openings"],
  });

  // Closed listings are news too, but the home strip leads with what is new.
  const latest = openings
    .filter((o) => o.status !== "closed")
    .slice(0, 3);

  if (!isLoading && latest.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">Latest openings</h2>
        <Link href="/openings" className="text-sm text-primary hover:underline font-semibold">
          Openings &amp; closings →
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {latest.map((opening) => {
            const meta = OPENING_STATUS_META[opening.status as OpeningStatus];
            return (
              <Link
                key={opening.id}
                href={opening.slug ? `/openings/${opening.slug}` : "/openings"}
                className="block bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-shadow"
              >
                <Badge className={`${meta?.badgeClass ?? ""} mb-2`}>
                  {meta?.label ?? opening.status}
                </Badge>
                <h3 className="font-bold text-neutral-900 mb-1">{opening.name}</h3>
                {opening.cuisine && (
                  <p className="text-sm text-neutral-600">{opening.cuisine}</p>
                )}
                {opening.location && (
                  <p className="text-sm text-neutral-500 flex items-center mt-1">
                    <MapPin className="h-4 w-4 mr-1.5" />
                    {opening.location}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
