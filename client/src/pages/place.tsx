import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Baby, MapPin, Star, Utensils } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TipsList from "@/components/TipsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo, toMetaDescription } from "@/lib/seo";
import { apiRequest } from "@/lib/queryClient";
import type { Attraction, Playground, Restaurant, TipTargetType } from "@shared/schema";

/** The three place types share a page; this describes how each one differs. */
export type PlaceKind = "restaurants" | "attractions" | "playgrounds";

/**
 * Route segments are plural, tip targets are singular. Mapping them explicitly
 * keeps a route rename from silently detaching a place's existing tips.
 */
const TIP_TARGET: Record<PlaceKind, TipTargetType> = {
  restaurants: "restaurant",
  attractions: "attraction",
  playgrounds: "playground",
};

type Place = Restaurant | Attraction | Playground;

const KIND_CONFIG: Record<
  PlaceKind,
  {
    routePattern: string;
    singular: string;
    /** schema.org type. Restaurants are businesses; the rest are places. */
    schemaType: string;
    icon: typeof Utensils;
    backLabel: string;
  }
> = {
  restaurants: {
    routePattern: "/restaurants/:slug",
    singular: "Restaurant",
    schemaType: "Restaurant",
    icon: Utensils,
    backLabel: "Back to restaurants",
  },
  attractions: {
    routePattern: "/attractions/:slug",
    singular: "Attraction",
    schemaType: "TouristAttraction",
    icon: MapPin,
    backLabel: "Back to attractions",
  },
  playgrounds: {
    routePattern: "/playgrounds/:slug",
    singular: "Playground",
    schemaType: "Playground",
    icon: Baby,
    backLabel: "Back to playgrounds",
  },
};

function isRestaurant(place: Place): place is Restaurant {
  return "cuisine" in place;
}

function isAttraction(place: Place): place is Attraction {
  return "type" in place && !("cuisine" in place);
}

function isPlayground(place: Place): place is Playground {
  return "features" in place;
}

/** Short line under the title: cuisine, attraction type, or playground features. */
function subtitleFor(place: Place): string {
  if (isRestaurant(place)) return place.cuisine;
  if (isAttraction(place)) return place.type;
  if (isPlayground(place)) return place.features;
  return "";
}

function buildPlaceJsonLd(
  place: Place,
  kind: PlaceKind,
  canonicalUrl: string,
): Record<string, unknown> {
  const config = KIND_CONFIG[kind];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": config.schemaType,
    name: place.name,
    url: canonicalUrl,
    address: {
      "@type": "PostalAddress",
      addressLocality: place.location || "Des Moines",
      addressRegion: "IA",
      addressCountry: "US",
    },
  };

  if (place.description) jsonLd.description = place.description;
  if (place.imageUrl) jsonLd.image = [place.imageUrl];

  if (isRestaurant(place)) {
    jsonLd.servesCuisine = place.cuisine;
    if (place.priceRange) jsonLd.priceRange = place.priceRange;
    if (place.rating) {
      jsonLd.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: place.rating,
        bestRating: 5,
        // Editorial rating, so one review: ours.
        reviewCount: 1,
      };
    }
  }

  return jsonLd;
}

export default function PlacePage({ kind }: { kind: PlaceKind }) {
  const config = KIND_CONFIG[kind];
  const [, params] = useRoute<{ slug: string }>(config.routePattern);
  const slug = params?.slug;

  const {
    data: place,
    isLoading,
    error,
  } = useQuery<Place>({
    queryKey: [`/api/${kind}/slug/${slug}`],
    enabled: Boolean(slug),
    retry: false,
  });

  // Viewing a place is the signal the "Most Searched" lists are built from.
  // Fire and forget: a failed or rate-limited count must never break the page.
  useEffect(() => {
    if (!place) return;
    apiRequest("POST", `/api/${kind}/${place.id}/search`).catch(() => {});
  }, [kind, place?.id]);

  const canonicalPath = slug ? `/${kind}/${slug}` : `/${kind}`;
  const description = toMetaDescription(
    place?.description || (place ? `${place.name} in ${place.location ?? "Des Moines"}` : ""),
  );

  useSeo({
    title: place
      ? place.name
      : isLoading
        ? `Loading ${config.singular.toLowerCase()}`
        : `${config.singular} not found`,
    description: place ? description : undefined,
    canonicalPath,
    imageUrl: place?.imageUrl ?? undefined,
    structuredData:
      place && typeof window !== "undefined"
        ? buildPlaceJsonLd(
            place,
            kind,
            new URL(canonicalPath, window.location.origin).toString(),
          )
        : undefined,
    noIndex: !place,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Skeleton className="h-8 w-40 mb-8" />
          <Skeleton className="w-full h-64 rounded-lg mb-8" />
          <Skeleton className="h-10 w-2/3 mb-4" />
          <Skeleton className="h-5 w-1/3 mb-8" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-3xl font-bold text-neutral-900 mb-4">
            {config.singular} not found
          </h1>
          <p className="text-neutral-600 mb-8">
            This listing may have been removed or the link may be out of date.
          </p>
          <Button asChild>
            <Link href="/">Browse what's on in Des Moines</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const Icon = config.icon;
  const subtitle = subtitleFor(place);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {config.backLabel}
        </Link>

        {place.imageUrl && (
          <img
            src={place.imageUrl}
            alt={place.name}
            className="w-full h-64 md:h-96 object-cover rounded-xl mb-8"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-primary text-white">{config.singular}</Badge>
          {isRestaurant(place) && place.rating > 0 && (
            <span className="flex items-center text-yellow-600">
              <Star className="h-4 w-4 fill-current mr-1" />
              <span className="font-semibold">{place.rating}</span>
              <span className="text-neutral-500 ml-1 text-sm">out of 5</span>
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
          {place.name}
        </h1>

        {subtitle && (
          <p className="text-lg text-neutral-600 mb-6 flex items-center">
            <Icon className="h-5 w-5 mr-2 text-primary" />
            {subtitle}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-neutral-700">
          {place.location && (
            <div className="flex items-start">
              <MapPin className="h-5 w-5 mr-3 mt-0.5 text-primary shrink-0" />
              <span>{place.location}</span>
            </div>
          )}
          {isRestaurant(place) && place.priceRange && (
            <div className="flex items-start">
              <span className="font-semibold mr-2">Price range:</span>
              <span>{place.priceRange}</span>
            </div>
          )}
          {isPlayground(place) && place.ageRange && (
            <div className="flex items-start">
              <Baby className="h-5 w-5 mr-3 mt-0.5 text-primary shrink-0" />
              <span>Ages: {place.ageRange}</span>
            </div>
          )}
        </div>

        {place.description && (
          <div className="prose max-w-none">
            <h2 className="text-xl font-semibold text-neutral-900 mb-3">
              About {place.name}
            </h2>
            <p className="text-neutral-600 leading-relaxed">{place.description}</p>
          </div>
        )}

        <TipsList targetType={TIP_TARGET[kind]} targetId={place.id} />
      </article>

      <Footer />
    </div>
  );
}
