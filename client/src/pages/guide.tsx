import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Baby,
  CalendarDays,
  ExternalLink,
  Lightbulb,
  MapPin,
  Sparkles,
  Ticket,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo, toMetaDescription } from "@/lib/seo";
import { getCountdown } from "@/lib/countdown";
import type { Event, InsiderTip, Neighborhood, Tentpole } from "@shared/schema";

interface GuidePayload {
  tentpole: Tentpole;
  neighborhood: Neighborhood | null;
  relatedEvents: Event[];
}

function dateRange(start: string | null, end: string | null): string {
  if (!start) return "Dates to be announced";
  const from = new Date(start);
  const to = end ? new Date(end) : from;
  if (from.toDateString() === to.toDateString()) return format(from, "EEEE, MMMM d, yyyy");
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${format(from, "MMMM d")}-${format(to, "d, yyyy")}`;
  }
  return `${format(from, "MMMM d")} - ${format(to, "MMMM d, yyyy")}`;
}

export default function GuidePage() {
  const [, params] = useRoute<{ slug: string }>("/guides/:slug");
  const slug = params?.slug;

  const { data, isLoading, error } = useQuery<GuidePayload>({
    queryKey: [`/api/tentpoles/${slug}`],
    enabled: Boolean(slug),
    retry: false,
  });

  const guide = data?.tentpole;
  const countdown = guide
    ? getCountdown(
        guide.nextStartDate as unknown as string,
        guide.nextEndDate as unknown as string,
      )
    : null;

  useSeo({
    title: guide ? `${guide.name} Guide` : isLoading ? "Loading guide" : "Guide not found",
    description: guide
      ? toMetaDescription(
          guide.description ?? `A local's guide to ${guide.name} in Des Moines.`,
        )
      : undefined,
    canonicalPath: slug ? `/guides/${slug}` : "/guides",
    imageUrl: guide?.heroImageUrl ?? undefined,
    noIndex: !guide,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Skeleton className="h-6 w-32 mb-8" />
          <Skeleton className="h-10 w-2/3 mb-4" />
          <Skeleton className="h-5 w-1/2 mb-10" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !data || !guide) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-3xl font-bold text-neutral-900 mb-4">Guide not found</h1>
          <p className="text-neutral-600 mb-8">
            We do not have a guide for that yet.
          </p>
          <Button asChild>
            <Link href="/guides">See all guides</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const tips = (guide.insiderTips ?? []) as InsiderTip[];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link
          href="/guides"
          className="inline-flex items-center text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          All guides
        </Link>

        {guide.heroImageUrl && (
          <img
            src={guide.heroImageUrl}
            alt={guide.name}
            className="w-full h-64 md:h-80 object-cover rounded-xl mb-8"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {countdown && (
            <Badge
              className={
                countdown.inProgress ? "bg-accent text-white" : "bg-primary text-white"
              }
            >
              {countdown.label}
            </Badge>
          )}
          {guide.isFree && (
            <Badge variant="secondary">
              <Ticket className="h-3 w-3 mr-1" />
              Free
            </Badge>
          )}
          {guide.isKidFriendly && (
            <Badge variant="secondary">
              <Baby className="h-3 w-3 mr-1" />
              Kid-friendly
            </Badge>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
          {guide.name}
        </h1>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-neutral-700 mb-8">
          <span className="inline-flex items-center">
            <CalendarDays className="h-5 w-5 mr-2 text-primary" />
            {dateRange(
              guide.nextStartDate as unknown as string,
              guide.nextEndDate as unknown as string,
            )}
          </span>
          {data.neighborhood && (
            <Link
              href={`/neighborhoods/${data.neighborhood.slug}`}
              className="inline-flex items-center hover:text-primary transition-colors"
            >
              <MapPin className="h-5 w-5 mr-2 text-primary" />
              {data.neighborhood.name}
            </Link>
          )}
        </div>

        {guide.typicalMonth && (
          <p className="text-sm text-neutral-500 mb-8">
            Usually held: {guide.typicalMonth}. Dates are approximate until the
            organizer confirms them.
          </p>
        )}

        {guide.description && (
          <p className="text-lg text-neutral-600 leading-relaxed mb-10">
            {guide.description}
          </p>
        )}

        {guide.whatsNewThisYear && (
          <section className="mb-10 bg-accent/10 border border-accent/20 rounded-xl p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-2 flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-accent" />
              What's new this year
            </h2>
            <p className="text-neutral-700">{guide.whatsNewThisYear}</p>
          </section>
        )}

        {tips.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6 flex items-center">
              <Lightbulb className="h-6 w-6 mr-2 text-primary" />
              Insider tips
            </h2>
            <div className="space-y-4">
              {tips.map((tip) => (
                <div
                  key={tip.title}
                  className="bg-white border border-neutral-200 rounded-lg p-5"
                >
                  <h3 className="font-semibold text-neutral-900 mb-1">{tip.title}</h3>
                  <p className="text-neutral-600">{tip.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.relatedEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Listed events
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.relatedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}

        {guide.officialUrl && (
          <div className="pt-6 border-t">
            <Button asChild size="lg">
              <a href={guide.officialUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Official site
              </a>
            </Button>
            <p className="text-xs text-neutral-500 mt-3">
              Always confirm dates and prices with the organizer before you go.
            </p>
          </div>
        )}
      </article>

      <Footer />
    </div>
  );
}
