import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, Moon } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/lib/seo";
import type { Event } from "@shared/schema";

interface WeekendDayPayload {
  label: "Friday" | "Saturday" | "Sunday";
  /** ISO calendar date in Des Moines time. */
  date: string;
  events: Event[];
}

interface ThisWeekendPayload {
  weekendInProgress: boolean;
  range: { start: string; end: string };
  tonight: { range: { start: string; end: string }; events: Event[] };
  days: WeekendDayPayload[];
}

/** Format an ISO date string without letting the browser's timezone shift it. */
function formatDayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return format(new Date(year, month - 1, day), "MMM d");
}

export default function ThisWeekendPage() {
  const [freeOnly, setFreeOnly] = useState(false);
  const [kidsOnly, setKidsOnly] = useState(false);
  const [indoorOnly, setIndoorOnly] = useState(false);

  const { data, isLoading } = useQuery<ThisWeekendPayload>({
    queryKey: ["/api/events/this-weekend"],
  });

  useSeo({
    title: "Things To Do in Des Moines This Weekend",
    description:
      "Everything happening in the Des Moines metro this Friday, Saturday and Sunday, with filters for free, kid-friendly and indoor events.",
    canonicalPath: "/this-weekend",
  });

  /**
   * Filters run on the client because the payload is one weekend of events and
   * re-fetching per toggle would be slower than filtering in place.
   * A toggle narrows to events we positively know match; unknown is excluded.
   */
  const matches = useMemo(() => {
    return (event: Event): boolean => {
      if (freeOnly && event.isFree !== true) return false;
      if (kidsOnly && event.isKidFriendly !== true) return false;
      if (indoorOnly && event.isIndoor !== true) return false;
      return true;
    };
  }, [freeOnly, kidsOnly, indoorOnly]);

  const days = (data?.days ?? []).map((day) => ({
    ...day,
    events: day.events.filter(matches),
  }));
  const tonightEvents = (data?.tonight.events ?? []).filter(matches);
  const totalShown = days.reduce((sum, day) => sum + day.events.length, 0);
  const anyFilterOn = freeOnly || kidsOnly || indoorOnly;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
          This weekend in Des Moines
        </h1>
        <p className="text-lg text-neutral-500 mb-8">
          {data?.weekendInProgress
            ? "The weekend is already under way. Here is what is left."
            : "Everything on from Friday through Sunday across the metro."}
        </p>

        {/* Tonight */}
        {!isLoading && tonightEvents.length > 0 && (
          <section className="mb-12 bg-neutral-900 text-white rounded-xl p-6">
            <h2 className="text-xl font-bold mb-1 flex items-center">
              <Moon className="h-5 w-5 mr-2" />
              Tonight
            </h2>
            <p className="text-neutral-300 text-sm mb-5">
              Starting after 4pm today.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tonightEvents.map((event) => (
                <a
                  key={event.id}
                  href={event.slug ? `/events/${event.slug}` : "#"}
                  className="block bg-white/10 hover:bg-white/20 transition-colors rounded-lg p-4"
                >
                  <p className="font-semibold mb-1">{event.title}</p>
                  <p className="text-sm text-neutral-300">
                    {format(new Date(event.date), "h:mm a")} · {event.location}
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 mb-10 pb-6 border-b">
          {[
            { id: "weekend-free", label: "Free only", checked: freeOnly, set: setFreeOnly },
            { id: "weekend-kids", label: "Kid-friendly", checked: kidsOnly, set: setKidsOnly },
            { id: "weekend-indoor", label: "Indoor only", checked: indoorOnly, set: setIndoorOnly },
          ].map((toggle) => (
            <div key={toggle.id} className="flex items-center space-x-2">
              <Switch
                id={toggle.id}
                checked={toggle.checked}
                onCheckedChange={toggle.set}
              />
              <Label htmlFor={toggle.id} className="cursor-pointer text-sm">
                {toggle.label}
              </Label>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-7 w-32 mb-6" />
                <Skeleton className="h-64 rounded-xl mb-4" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {days.map((day) => (
                <section key={day.date}>
                  <div className="flex items-baseline justify-between mb-6">
                    <h2 className="text-2xl font-bold text-neutral-900">{day.label}</h2>
                    <span className="text-sm text-neutral-500">
                      {formatDayDate(day.date)}
                    </span>
                  </div>

                  {day.events.length > 0 ? (
                    <div className="space-y-6">
                      {day.events.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 px-4 border border-dashed border-neutral-200 rounded-xl text-neutral-500">
                      <CalendarDays className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
                      <p className="text-sm">
                        {anyFilterOn
                          ? "Nothing matching those filters"
                          : "Nothing listed yet"}
                      </p>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {totalShown === 0 && anyFilterOn && (
              <div className="text-center mt-12">
                <Badge variant="secondary" className="text-sm">
                  Try turning a filter off to see more
                </Badge>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
