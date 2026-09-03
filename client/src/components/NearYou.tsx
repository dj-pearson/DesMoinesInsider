import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/hooks/use-auth";
import type { Event, Neighborhood } from "@shared/schema";

interface NeighborhoodContent {
  neighborhood: Neighborhood;
  upcomingEvents: Event[];
}

/**
 * Shown above everything else when a signed-in reader has set a home
 * neighborhood. Renders nothing at all otherwise, rather than an empty shell.
 */
export default function NearYou() {
  const { user } = useAuth();

  const { data: neighborhoods } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
    enabled: Boolean(user?.homeNeighborhoodId),
  });

  const home = (neighborhoods ?? []).find((n) => n.id === user?.homeNeighborhoodId);

  const { data } = useQuery<NeighborhoodContent>({
    queryKey: [`/api/neighborhoods/${home?.slug}`],
    enabled: Boolean(home?.slug),
  });

  const events = (data?.upcomingEvents ?? []).slice(0, 3);
  if (!user?.homeNeighborhoodId || !home || events.length === 0) return null;

  return (
    <section className="py-12 bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">
            Near you in {home.name}
          </h2>
          <Link
            href={`/neighborhoods/${home.slug}`}
            className="text-sm text-primary hover:underline font-semibold"
          >
            All of {home.name} →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}
