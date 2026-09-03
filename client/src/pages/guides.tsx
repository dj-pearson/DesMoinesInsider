import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { CalendarDays, Ticket } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/lib/seo";
import { getCountdown } from "@/lib/countdown";
import type { Tentpole } from "@shared/schema";

/** Date range text, collapsing single-day events to one date. */
function dateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const from = new Date(start);
  const to = end ? new Date(end) : from;
  if (from.toDateString() === to.toDateString()) {
    return format(from, "MMMM d, yyyy");
  }
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${format(from, "MMMM d")}-${format(to, "d, yyyy")}`;
  }
  return `${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")}`;
}

export default function GuidesPage() {
  const { data: guides, isLoading } = useQuery<Tentpole[]>({
    queryKey: ["/api/tentpoles"],
  });

  useSeo({
    title: "Des Moines Festival & Event Guides",
    description:
      "Guides to the events Des Moines plans its year around: the Iowa State Fair, Drake Relays, 80/35, the Downtown Farmers' Market and more, with dates and practical tips.",
    canonicalPath: "/guides",
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
          The year in Des Moines
        </h1>
        <p className="text-lg text-neutral-500 mb-12 max-w-2xl">
          The dozen or so events people here actually plan around, with dates,
          what to expect, and the things first-timers get wrong.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(guides ?? []).map((guide) => {
              const countdown = getCountdown(
                guide.nextStartDate as unknown as string,
                guide.nextEndDate as unknown as string,
              );
              return (
                <Link
                  key={guide.id}
                  href={`/guides/${guide.slug}`}
                  className="block bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-6"
                >
                  <div className="flex items-center gap-2 mb-3">
                    {countdown && (
                      <Badge
                        className={
                          countdown.inProgress
                            ? "bg-accent text-white"
                            : "bg-primary text-white"
                        }
                      >
                        {countdown.label}
                      </Badge>
                    )}
                    {guide.isFree && (
                      <Badge variant="secondary" className="text-xs">
                        <Ticket className="h-3 w-3 mr-1" />
                        Free
                      </Badge>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-neutral-900 mb-2">
                    {guide.name}
                  </h2>

                  <p className="text-sm text-neutral-500 mb-3 flex items-center">
                    <CalendarDays className="h-4 w-4 mr-1.5 text-primary" />
                    {dateRange(
                      guide.nextStartDate as unknown as string,
                      guide.nextEndDate as unknown as string,
                    )}
                  </p>

                  {guide.description && (
                    <p className="text-sm text-neutral-600 line-clamp-3">
                      {guide.description}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
