import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Baby, CalendarDays, MapPin, Utensils } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/lib/seo";
import type { Neighborhood } from "@shared/schema";

/** The API adds these counts to each row. */
interface NeighborhoodWithCounts extends Neighborhood {
  upcomingEventCount: number;
  restaurantOpeningCount: number;
  playgroundCount: number;
  restaurantCount: number;
  attractionCount: number;
}

/** Reader-facing labels for the three kinds, in the order they are shown. */
const GROUPS: Array<{ kind: string; label: string; blurb: string }> = [
  {
    kind: "district",
    label: "Districts",
    blurb: "The compact areas people name when they are making plans.",
  },
  {
    kind: "neighborhood",
    label: "Des Moines neighborhoods",
    blurb: "Where people actually live inside the city.",
  },
  {
    kind: "suburb",
    label: "Suburbs",
    blurb: "The rest of the metro, each with its own calendar.",
  },
];

function CountLine({
  icon: Icon,
  count,
  singular,
}: {
  icon: typeof CalendarDays;
  count: number;
  singular: string;
}) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center text-sm text-neutral-600 mr-4">
      <Icon className="h-4 w-4 mr-1 text-primary" />
      {count} {count === 1 ? singular : `${singular}s`}
    </span>
  );
}

export default function NeighborhoodsPage() {
  const { data: neighborhoods, isLoading } = useQuery<NeighborhoodWithCounts[]>({
    queryKey: ["/api/neighborhoods"],
  });

  useSeo({
    title: "Des Moines Neighborhoods & Suburbs",
    description:
      "Browse events, new restaurant openings, playgrounds and things to do by neighborhood across the Des Moines metro, from the East Village to Ankeny.",
    canonicalPath: "/neighborhoods",
  });

  const grouped = GROUPS.map((group) => ({
    ...group,
    items: (neighborhoods ?? []).filter((n) => n.kind === group.kind),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
          Neighborhoods
        </h1>
        <p className="text-lg text-neutral-500 mb-12 max-w-2xl">
          Des Moines is a metro of small places with strong identities. Pick yours to
          see what is on, what is opening and where to take the kids.
        </p>

        {isLoading ? (
          <div className="space-y-12">
            {[...Array(2)].map((_, groupIndex) => (
              <div key={groupIndex}>
                <Skeleton className="h-7 w-48 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, cardIndex) => (
                    <Skeleton key={cardIndex} className="h-40 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-14">
            {grouped.map((group) => (
              <section key={group.kind}>
                <h2 className="text-2xl font-bold text-neutral-900 mb-1">
                  {group.label}
                </h2>
                <p className="text-neutral-500 mb-6">{group.blurb}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.items.map((neighborhood) => (
                    <Link
                      key={neighborhood.id}
                      href={`/neighborhoods/${neighborhood.slug}`}
                      className="block bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-6"
                    >
                      <h3 className="text-xl font-bold text-neutral-900 mb-2">
                        {neighborhood.name}
                      </h3>
                      {neighborhood.description && (
                        <p className="text-sm text-neutral-600 mb-4 line-clamp-3">
                          {neighborhood.description}
                        </p>
                      )}
                      <div className="flex flex-wrap">
                        <CountLine
                          icon={CalendarDays}
                          count={neighborhood.upcomingEventCount}
                          singular="event"
                        />
                        <CountLine
                          icon={Utensils}
                          count={neighborhood.restaurantOpeningCount}
                          singular="opening"
                        />
                        <CountLine
                          icon={Baby}
                          count={neighborhood.playgroundCount}
                          singular="playground"
                        />
                        <CountLine
                          icon={MapPin}
                          count={neighborhood.attractionCount}
                          singular="attraction"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
