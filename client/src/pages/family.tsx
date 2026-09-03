import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Baby,
  BookOpen,
  Droplets,
  Home,
  Leaf,
  Ticket,
  TreePine,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/lib/seo";
import type { Event, Neighborhood, Playground, PlaygroundKind } from "@shared/schema";
import {
  familySectionOrder,
  isSplashSeason,
} from "@shared/familySeason";

interface FamilyPayload {
  /** 1-12, in Des Moines time. */
  month: number;
  freeThisWeekend: Event[];
  places: Playground[];
  neighborhoods: Neighborhood[];
}

const KIND_META: Record<
  PlaygroundKind,
  { title: string; blurb: string; icon: typeof Baby }
> = {
  playground: {
    title: "Playgrounds",
    blurb: "Grouped by where they are, so you can find one near you.",
    icon: TreePine,
  },
  splash_pad: {
    title: "Splash pads and pools",
    blurb: "Open for the warm months only.",
    icon: Droplets,
  },
  indoor_play: {
    title: "Indoor play",
    blurb: "For the half of the year when outside is not an option.",
    icon: Home,
  },
  library: {
    title: "Libraries and storytimes",
    blurb: "Free, warm, and open most days.",
    icon: BookOpen,
  },
  nature_center: {
    title: "Nature centers and zoos",
    blurb: "Worth the drive when you have a whole morning.",
    icon: Leaf,
  },
};

function PlaceCard({ place }: { place: Playground }) {
  return (
    <Link
      href={place.slug ? `/playgrounds/${place.slug}` : "#"}
      className="block bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-shadow"
    >
      <h3 className="font-bold text-neutral-900 mb-1">{place.name}</h3>
      <p className="text-sm text-neutral-600 mb-3">{place.features}</p>

      <div className="flex flex-wrap gap-1.5">
        {place.ageRange && (
          <Badge variant="secondary" className="text-xs">
            {place.ageRange}
          </Badge>
        )}
        {place.hasSplashPad && (
          <Badge variant="secondary" className="text-xs">
            Splash pad
          </Badge>
        )}
        {place.isFenced && (
          <Badge variant="secondary" className="text-xs">
            Fenced
          </Badge>
        )}
        {place.hasRestrooms && (
          <Badge variant="secondary" className="text-xs">
            Restrooms
          </Badge>
        )}
        {place.hasShade && (
          <Badge variant="secondary" className="text-xs">
            Shade
          </Badge>
        )}
        {place.isSkywalkAccessible && (
          <Badge variant="secondary" className="text-xs">
            Skywalk
          </Badge>
        )}
      </div>

      {place.seasonOpen && (
        <p className="text-xs text-neutral-500 mt-3">Open {place.seasonOpen}</p>
      )}
    </Link>
  );
}

export default function FamilyPage() {
  const { data, isLoading } = useQuery<FamilyPayload>({
    queryKey: ["/api/family"],
  });

  useSeo({
    title: "Des Moines With Kids",
    description:
      "Playgrounds, splash pads, indoor play, libraries and free family events across the Des Moines metro, with the details that decide whether a trip is worth it.",
    canonicalPath: "/family",
  });

  const month = data?.month ?? new Date().getMonth() + 1;
  const places = data?.places ?? [];
  const byKind = (kind: PlaygroundKind) => places.filter((p) => p.kind === kind);

  const sectionOrder = familySectionOrder(month);

  const playgroundsByNeighborhood = (data?.neighborhoods ?? [])
    .map((neighborhood) => ({
      neighborhood,
      items: byKind("playground").filter((p) => p.neighborhoodId === neighborhood.id),
    }))
    .filter((group) => group.items.length > 0);

  const unplaced = byKind("playground").filter((p) => !p.neighborhoodId);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
          Des Moines with kids
        </h1>
        <p className="text-lg text-neutral-500 mb-12 max-w-2xl">
          Where to go, what it costs, and the details that actually decide it:
          shade in August, fences for a runner, and somewhere warm in January.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Free this weekend */}
            <section className="mb-14">
              <h2 className="text-2xl font-bold text-neutral-900 mb-1 flex items-center">
                <Ticket className="h-6 w-6 mr-2 text-primary" />
                Free this weekend
              </h2>
              <p className="text-neutral-500 mb-6">
                Events we know are both free and welcoming to kids.
              </p>

              {(data?.freeThisWeekend.length ?? 0) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data!.freeThisWeekend.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-neutral-200 rounded-xl py-10 text-center text-neutral-500">
                  <Baby className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
                  <p className="text-sm">
                    Nothing confirmed free and kid-friendly this weekend yet.
                  </p>
                </div>
              )}
            </section>

            {sectionOrder.map((kind) => {
              const items = byKind(kind);
              if (items.length === 0) return null;
              const meta = KIND_META[kind];
              const Icon = meta.icon;

              // Playgrounds are the one group worth splitting by neighborhood;
              // there are enough of them that a flat list stops being useful.
              if (kind === "playground" && playgroundsByNeighborhood.length > 0) {
                return (
                  <section key={kind} className="mb-14">
                    <h2 className="text-2xl font-bold text-neutral-900 mb-1 flex items-center">
                      <Icon className="h-6 w-6 mr-2 text-primary" />
                      {meta.title}
                    </h2>
                    <p className="text-neutral-500 mb-6">{meta.blurb}</p>

                    <div className="space-y-10">
                      {playgroundsByNeighborhood.map(({ neighborhood, items: group }) => (
                        <div key={neighborhood.id}>
                          <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                            <Link
                              href={`/neighborhoods/${neighborhood.slug}`}
                              className="hover:text-primary transition-colors"
                            >
                              {neighborhood.name}
                            </Link>
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {group.map((place) => (
                              <PlaceCard key={place.id} place={place} />
                            ))}
                          </div>
                        </div>
                      ))}

                      {unplaced.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                            Elsewhere in the metro
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {unplaced.map((place) => (
                              <PlaceCard key={place.id} place={place} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                );
              }

              return (
                <section key={kind} className="mb-14">
                  <h2 className="text-2xl font-bold text-neutral-900 mb-1 flex items-center">
                    <Icon className="h-6 w-6 mr-2 text-primary" />
                    {meta.title}
                    {kind === "splash_pad" && !isSplashSeason(month) && (
                      <Badge variant="secondary" className="ml-3 text-xs font-normal">
                        Out of season
                      </Badge>
                    )}
                  </h2>
                  <p className="text-neutral-500 mb-6">{meta.blurb}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((place) => (
                      <PlaceCard key={place.id} place={place} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
