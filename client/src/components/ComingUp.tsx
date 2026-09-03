import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCountdown } from "@/lib/countdown";
import type { Tentpole } from "@shared/schema";

/**
 * The next few tentpole events, shown above featured events on the home page.
 * These are what people plan around months ahead, so they earn the top slot.
 */
export default function ComingUp() {
  const { data: guides } = useQuery<Tentpole[]>({
    queryKey: ["/api/tentpoles?upcoming=true&limit=3"],
  });

  if (!guides || guides.length === 0) return null;

  return (
    <section className="py-12 bg-neutral-50 border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">Coming up</h2>
          <Link
            href="/guides"
            className="text-sm text-primary hover:underline font-semibold"
          >
            All guides →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {guides.map((guide) => {
            const countdown = getCountdown(
              guide.nextStartDate as unknown as string,
              guide.nextEndDate as unknown as string,
            );
            return (
              <Link
                key={guide.id}
                href={`/guides/${guide.slug}`}
                className="block bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-5"
              >
                {countdown && (
                  <Badge
                    className={
                      countdown.inProgress
                        ? "bg-accent text-white mb-3"
                        : "bg-primary text-white mb-3"
                    }
                  >
                    {countdown.label}
                  </Badge>
                )}
                <h3 className="font-bold text-neutral-900 mb-1">{guide.name}</h3>
                {guide.nextStartDate && (
                  <p className="text-sm text-neutral-500 flex items-center">
                    <CalendarDays className="h-4 w-4 mr-1.5" />
                    {format(new Date(guide.nextStartDate as unknown as string), "MMMM d, yyyy")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
