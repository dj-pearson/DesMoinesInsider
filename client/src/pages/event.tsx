import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Lightbulb,
  MapPin,
  Sparkles,
  Ticket,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TipsList from "@/components/TipsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo, toMetaDescription } from "@/lib/seo";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Event } from "@shared/schema";

function formatEventDate(date: string | Date): string {
  try {
    return format(new Date(date), "EEEE, MMMM d, yyyy 'at' h:mm a");
  } catch {
    return "Date and time to be announced";
  }
}

/** Google's Event structured data, so the listing can appear as a rich result. */
function buildEventJsonLd(event: Event, canonicalUrl: string): Record<string, unknown> {
  const description =
    event.enhancedDescription || event.originalDescription || event.title;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description,
    url: canonicalUrl,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: event.venue || event.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.location,
        addressRegion: "IA",
        addressCountry: "US",
      },
    },
  };

  const startDate = new Date(event.date);
  if (!Number.isNaN(startDate.getTime())) {
    jsonLd.startDate = startDate.toISOString();
  }

  if (event.imageUrl) {
    jsonLd.image = [event.imageUrl];
  }

  if (event.price) {
    const isFree = /free|no charge|\$0\b/i.test(event.price);
    jsonLd.offers = {
      "@type": "Offer",
      price: isFree ? "0" : undefined,
      priceCurrency: "USD",
      // Keep the human-readable text; ranges like "$15-25" are not a number.
      description: event.price,
      availability: "https://schema.org/InStock",
      url: event.sourceUrl || canonicalUrl,
    };
  }

  return jsonLd;
}

export default function EventPage() {
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug;

  const {
    data: event,
    isLoading,
    error,
  } = useQuery<Event>({
    queryKey: [`/api/events/slug/${slug}`],
    enabled: Boolean(slug),
    retry: false,
  });

  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Saved state comes from the user's own list rather than a per-event flag,
  // so it stays correct without another endpoint.
  const { data: saved } = useQuery<Event[]>({
    queryKey: ["/api/me/saved"],
    enabled: Boolean(user),
    retry: false,
  });
  const isSaved = Boolean(event && saved?.some((e) => e.id === event.id));

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!event) return;
      return apiRequest(isSaved ? "DELETE" : "POST", `/api/events/${event.id}/save`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/saved"] });
    },
  });

  const canonicalPath = slug ? `/events/${slug}` : "/events";
  const description = toMetaDescription(
    event?.enhancedDescription || event?.originalDescription || event?.title,
  );

  useSeo({
    title: event ? event.title : isLoading ? "Loading event" : "Event not found",
    description: event ? description : undefined,
    canonicalPath,
    imageUrl: event?.imageUrl ?? undefined,
    structuredData:
      event && typeof window !== "undefined"
        ? buildEventJsonLd(event, new URL(canonicalPath, window.location.origin).toString())
        : undefined,
    noIndex: !event,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="w-full h-72 rounded-lg mb-8" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-5 w-1/2 mb-2" />
          <Skeleton className="h-5 w-1/3 mb-8" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-3xl font-bold text-neutral-900 mb-4">Event not found</h1>
          <p className="text-neutral-600 mb-8">
            This event may have ended or the link may be out of date.
          </p>
          <Button asChild>
            <Link href="/">Browse what's on in Des Moines</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-neutral-500 hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to events
        </Link>

        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-64 md:h-96 object-cover rounded-xl mb-8"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        <Badge className="bg-primary text-white mb-4">{event.category}</Badge>

        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900">
            {event.title}
          </h1>
          {user && (
            <Button
              variant={isSaved ? "default" : "outline"}
              onClick={() => toggleSave.mutate()}
              disabled={toggleSave.isPending}
              className="shrink-0"
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-neutral-700">
          <div className="flex items-start">
            <Calendar className="h-5 w-5 mr-3 mt-0.5 text-primary shrink-0" />
            <span>{formatEventDate(event.date)}</span>
          </div>
          <div className="flex items-start">
            <MapPin className="h-5 w-5 mr-3 mt-0.5 text-primary shrink-0" />
            <span>{event.venue ? `${event.venue}, ${event.location}` : event.location}</span>
          </div>
          {event.price && (
            <div className="flex items-start">
              <Ticket className="h-5 w-5 mr-3 mt-0.5 text-primary shrink-0" />
              <span>{event.price}</span>
            </div>
          )}
        </div>

        {event.insiderTip && (
          <section className="mb-8 bg-accent/10 border border-accent/20 rounded-xl p-5">
            <h2 className="font-bold text-neutral-900 mb-1 flex items-center">
              <Lightbulb className="h-5 w-5 mr-2 text-accent" />
              Insider tip
            </h2>
            <p className="text-neutral-700">{event.insiderTip}</p>
          </section>
        )}

        <div className="prose max-w-none mb-8">
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">About this event</h2>
          <p className="text-neutral-600 leading-relaxed whitespace-pre-line">
            {event.enhancedDescription || event.originalDescription}
          </p>
          {event.isEnhanced && (
            <p className="text-sm text-accent mt-3 flex items-center">
              <Sparkles className="h-4 w-4 mr-1" />
              Description enhanced with AI
            </p>
          )}
        </div>

        {event.sourceUrl && (
          <div className="pt-6 border-t">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Get tickets / details
              </a>
            </Button>
            <p className="text-xs text-neutral-500 mt-3">
              Opens the organizer's site. Always confirm times and prices there before
              you go.
            </p>
          </div>
        )}

        <TipsList targetType="event" targetId={event.id} />
      </article>

      <Footer />
    </div>
  );
}
