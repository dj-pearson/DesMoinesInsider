import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, Lightbulb, MapPin } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo, toMetaDescription } from "@/lib/seo";
import { OPENING_STATUS_META } from "@shared/openingStatus";
import type { OpeningStatus, RestaurantOpening } from "@shared/schema";

/** Hostname only, so attribution reads "dsmmagazine.com" rather than a long URL. */
function sourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function OpeningPage() {
  const [, params] = useRoute<{ slug: string }>("/openings/:slug");
  const slug = params?.slug;

  const { data: opening, isLoading, error } = useQuery<RestaurantOpening>({
    queryKey: [`/api/restaurant-openings/slug/${slug}`],
    enabled: Boolean(slug),
    retry: false,
  });

  const meta = opening
    ? OPENING_STATUS_META[opening.status as OpeningStatus]
    : undefined;

  useSeo({
    title: opening
      ? `${opening.name} — ${meta?.label ?? "Restaurant news"}`
      : isLoading
        ? "Loading"
        : "Not found",
    description: opening
      ? toMetaDescription(
          opening.description ??
            `${opening.name} in ${opening.location ?? "Des Moines"}: ${meta?.label ?? ""}.`,
        )
      : undefined,
    canonicalPath: slug ? `/openings/${slug}` : "/openings",
    noIndex: !opening,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Skeleton className="h-6 w-32 mb-8" />
          <Skeleton className="h-10 w-2/3 mb-4" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !opening) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-3xl font-bold text-neutral-900 mb-4">Not found</h1>
          <p className="text-neutral-600 mb-8">
            We do not have a page for that listing.
          </p>
          <Button asChild>
            <Link href="/openings">See all openings and closings</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link
          href="/openings"
          className="inline-flex items-center text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          All openings and closings
        </Link>

        <Badge className={`${meta?.badgeClass ?? ""} mb-4`}>
          {meta?.label ?? opening.status}
        </Badge>

        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
          {opening.name}
        </h1>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-neutral-700 mb-8">
          {opening.cuisine && <span>{opening.cuisine}</span>}
          {(opening.address || opening.location) && (
            <span className="inline-flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-primary" />
              {opening.address ?? opening.location}
            </span>
          )}
          {opening.openingDate && (
            <span>{format(new Date(opening.openingDate), "MMMM d, yyyy")}</span>
          )}
        </div>

        {opening.description && (
          <p className="text-lg text-neutral-600 leading-relaxed mb-8">
            {opening.description}
          </p>
        )}

        {opening.firstLookTip && (
          <section className="mb-8 bg-accent/10 border border-accent/20 rounded-xl p-5">
            <h2 className="font-bold text-neutral-900 mb-1 flex items-center">
              <Lightbulb className="h-5 w-5 mr-2 text-accent" />
              First look
            </h2>
            <p className="text-neutral-700">{opening.firstLookTip}</p>
          </section>
        )}

        {opening.sourceUrl && (
          <div className="pt-6 border-t">
            <p className="text-sm text-neutral-500 mb-3">
              Reported by {sourceName(opening.sourceUrl)}.
            </p>
            <Button asChild variant="outline">
              <a href={opening.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Read the original story
              </a>
            </Button>
          </div>
        )}
      </article>

      <Footer />
    </div>
  );
}
