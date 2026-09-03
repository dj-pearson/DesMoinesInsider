import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Baby, CalendarDays, MapPin, Utensils } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo, toMetaDescription } from "@/lib/seo";
import type {
  Attraction,
  Event,
  Neighborhood,
  Playground,
  Restaurant,
  RestaurantOpening,
} from "@shared/schema";

interface NeighborhoodWithCounts extends Neighborhood {
  upcomingEventCount: number;
  restaurantOpeningCount: number;
  playgroundCount: number;
  restaurantCount: number;
  attractionCount: number;
}

interface NeighborhoodContent {
  neighborhood: NeighborhoodWithCounts;
  upcomingEvents: Event[];
  restaurantOpenings: RestaurantOpening[];
  restaurants: Restaurant[];
  attractions: Attraction[];
  playgrounds: Playground[];
}

/** Human label for an opening's lifecycle stage. */
const OPENING_STATUS_LABEL: Record<string, string> = {
  opening_soon: "Opening soon",
  newly_opened: "Just opened",
  announced: "Announced",
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mb-14">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">{title}</h2>
      {children}
    </section>
  );
}

/** Compact card for the place lists, which share a shape. */
function PlaceCard({
  href,
  name,
  detail,
  imageUrl,
}: {
  href: string;
  name: string;
  detail: string | null;
  imageUrl: string | null;
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-lg border border-neutral-200 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-36 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="p-4">
        <h3 className="font-semibold text-neutral-900 mb-1">{name}</h3>
        {detail && <p className="text-sm text-neutral-600">{detail}</p>}
      </div>
    </Link>
  );
}

export default function NeighborhoodPage() {
  const [, params] = useRoute<{ slug: string }>("/neighborhoods/:slug");
  const slug = params?.slug;

  const {
    data,
    isLoading,
    error,
  } = useQuery<NeighborhoodContent>({
    queryKey: [`/api/neighborhoods/${slug}`],
    enabled: Boolean(slug),
    retry: false,
  });

  const neighborhood = data?.neighborhood;

  useSeo({
    // The exact title shape the story asks for: it targets the way people
    // search for a specific part of town.
    title: neighborhood
      ? `${neighborhood.name} Events, Openings & Things To Do`
      : isLoading
        ? "Loading neighborhood"
        : "Neighborhood not found",
    description: neighborhood
      ? toMetaDescription(
          neighborhood.description ??
            `What's on in ${neighborhood.name}: upcoming events, new restaurant openings, playgrounds and things to do.`,
        )
      : undefined,
    canonicalPath: slug ? `/neighborhoods/${slug}` : "/neighborhoods",
    imageUrl: neighborhood?.heroImageUrl ?? undefined,
    noIndex: !neighborhood,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Skeleton className="h-6 w-40 mb-8" />
          <Skeleton className="h-10 w-1/2 mb-4" />
          <Skeleton className="h-5 w-3/4 mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !data || !neighborhood) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-3xl font-bold text-neutral-900 mb-4">
            Neighborhood not found
          </h1>
          <p className="text-neutral-600 mb-8">
            We do not have a page for that part of the metro yet.
          </p>
          <Button asChild>
            <Link href="/neighborhoods">Browse all neighborhoods</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const hasAnything =
    data.upcomingEvents.length +
      data.restaurantOpenings.length +
      data.restaurants.length +
      data.attractions.length +
      data.playgrounds.length >
    0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link
          href="/neighborhoods"
          className="inline-flex items-center text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          All neighborhoods
        </Link>

        {/* Hero */}
        <header className="mb-12">
          {neighborhood.heroImageUrl && (
            <img
              src={neighborhood.heroImageUrl}
              alt={neighborhood.name}
              className="w-full h-56 md:h-72 object-cover rounded-xl mb-8"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <Badge className="bg-primary text-white mb-3 capitalize">
            {neighborhood.kind}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            {neighborhood.name}
          </h1>
          {neighborhood.description && (
            <p className="text-lg text-neutral-600 max-w-3xl mb-6">
              {neighborhood.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-600">
            <span className="inline-flex items-center">
              <CalendarDays className="h-4 w-4 mr-1.5 text-primary" />
              {neighborhood.upcomingEventCount} upcoming{" "}
              {neighborhood.upcomingEventCount === 1 ? "event" : "events"}
            </span>
            <span className="inline-flex items-center">
              <Utensils className="h-4 w-4 mr-1.5 text-primary" />
              {neighborhood.restaurantOpeningCount}{" "}
              {neighborhood.restaurantOpeningCount === 1 ? "opening" : "openings"}
            </span>
            <span className="inline-flex items-center">
              <Baby className="h-4 w-4 mr-1.5 text-primary" />
              {neighborhood.playgroundCount}{" "}
              {neighborhood.playgroundCount === 1 ? "playground" : "playgrounds"}
            </span>
            <span className="inline-flex items-center">
              <MapPin className="h-4 w-4 mr-1.5 text-primary" />
              {neighborhood.attractionCount}{" "}
              {neighborhood.attractionCount === 1 ? "attraction" : "attractions"}
            </span>
          </div>
        </header>

        <Section title="Coming up in the next 30 days" count={data.upcomingEvents.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </Section>

        <Section title="Restaurant news" count={data.restaurantOpenings.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.restaurantOpenings.map((opening) => (
              <div
                key={opening.id}
                className="bg-white rounded-lg border border-neutral-200 p-4"
              >
                <Badge variant="secondary" className="mb-2 text-xs">
                  {OPENING_STATUS_LABEL[opening.status] ?? opening.status}
                </Badge>
                <h3 className="font-semibold text-neutral-900 mb-1">{opening.name}</h3>
                {opening.cuisine && (
                  <p className="text-sm text-neutral-600">{opening.cuisine}</p>
                )}
                {opening.openingDate && (
                  <p className="text-sm text-neutral-500 mt-1">
                    {format(new Date(opening.openingDate), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Where to eat" count={data.restaurants.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.restaurants.map((restaurant) => (
              <PlaceCard
                key={restaurant.id}
                href={`/restaurants/${restaurant.slug}`}
                name={restaurant.name}
                detail={restaurant.cuisine}
                imageUrl={restaurant.imageUrl}
              />
            ))}
          </div>
        </Section>

        <Section title="Things to do" count={data.attractions.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.attractions.map((attraction) => (
              <PlaceCard
                key={attraction.id}
                href={`/attractions/${attraction.slug}`}
                name={attraction.name}
                detail={attraction.type}
                imageUrl={attraction.imageUrl}
              />
            ))}
          </div>
        </Section>

        <Section title="With kids" count={data.playgrounds.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.playgrounds.map((playground) => (
              <PlaceCard
                key={playground.id}
                href={`/playgrounds/${playground.slug}`}
                name={playground.name}
                detail={playground.features}
                imageUrl={playground.imageUrl}
              />
            ))}
          </div>
        </Section>

        {!hasAnything && (
          <div className="text-center py-16 text-neutral-500">
            <CalendarDays className="h-14 w-14 mx-auto mb-4 text-neutral-300" />
            <p className="text-lg mb-2">Nothing listed here yet</p>
            <p className="text-sm">
              We are still building out {neighborhood.name}. Check back soon.
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
