import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { MapPin, Utensils } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OpeningsMap from "@/components/OpeningsMap";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/lib/seo";
import { OPENING_STATUS_META, OPENING_TAB_ORDER } from "@shared/openingStatus";
import type { OpeningStatus, RestaurantOpening } from "@shared/schema";

export default function OpeningsPage() {
  const [activeTab, setActiveTab] = useState<OpeningStatus>("opening_soon");

  const { data: openings, isLoading } = useQuery<RestaurantOpening[]>({
    queryKey: ["/api/restaurant-openings"],
  });

  useSeo({
    title: "Des Moines Restaurant Openings & Closings",
    description:
      "Every new restaurant opening and closing across the Des Moines metro, tracked from local news and mapped by neighborhood.",
    canonicalPath: "/openings",
  });

  const all = openings ?? [];
  const countFor = (status: OpeningStatus) =>
    all.filter((o) => o.status === status).length;
  const visible = all.filter((o) => o.status === activeTab);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
          Openings &amp; closings
        </h1>
        <p className="text-lg text-neutral-500 mb-10 max-w-2xl">
          What is new, what is coming, and what has closed across the metro.
          Tracked from local reporting and updated as it lands.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <OpeningsMap openings={visible} />

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-8 border-b pb-4">
              {OPENING_TAB_ORDER.map((status) => {
                const meta = OPENING_STATUS_META[status];
                const count = countFor(status);
                const active = status === activeTab;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActiveTab(status)}
                    aria-pressed={active}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    {meta.tabLabel}
                    <span className={active ? "ml-2 opacity-80" : "ml-2 text-neutral-500"}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-sm text-neutral-500 mb-6">
              {OPENING_STATUS_META[activeTab].description}
            </p>

            {visible.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visible.map((opening) => {
                  const meta = OPENING_STATUS_META[opening.status as OpeningStatus];
                  const card = (
                    <>
                      <Badge className={`${meta?.badgeClass ?? ""} mb-3`}>
                        {meta?.label ?? opening.status}
                      </Badge>
                      <h2 className="text-lg font-bold text-neutral-900 mb-1">
                        {opening.name}
                      </h2>
                      {opening.cuisine && (
                        <p className="text-sm text-neutral-600 mb-2">{opening.cuisine}</p>
                      )}
                      {opening.location && (
                        <p className="text-sm text-neutral-500 flex items-center mb-2">
                          <MapPin className="h-4 w-4 mr-1.5" />
                          {opening.location}
                        </p>
                      )}
                      {opening.openingDate && (
                        <p className="text-sm text-neutral-500">
                          {format(new Date(opening.openingDate), "MMMM d, yyyy")}
                        </p>
                      )}
                    </>
                  );

                  return opening.slug ? (
                    <Link
                      key={opening.id}
                      href={`/openings/${opening.slug}`}
                      className="block bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-shadow"
                    >
                      {card}
                    </Link>
                  ) : (
                    <div
                      key={opening.id}
                      className="bg-white rounded-xl border border-neutral-200 p-5"
                    >
                      {card}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-neutral-500">
                <Utensils className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                <p className="text-lg mb-1">Nothing here right now</p>
                <p className="text-sm">
                  We add these as local reporting appears. Try another tab.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
