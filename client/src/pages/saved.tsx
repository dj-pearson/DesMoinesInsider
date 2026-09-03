import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bookmark } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useSeo } from "@/lib/seo";
import type { Event } from "@shared/schema";

export default function SavedPage() {
  const { user, isLoading: authLoading } = useAuth();

  useSeo({
    title: "Saved events",
    description: "Events you have saved on Des Moines Insider.",
    canonicalPath: "/saved",
    noIndex: true,
  });

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/me/saved"],
    enabled: Boolean(user),
    retry: false,
  });

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-md mx-auto px-4 py-24 text-center">
          <Bookmark className="h-10 w-10 mx-auto mb-4 text-neutral-300" />
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Saved events</h1>
          <p className="text-neutral-600 mb-6">Sign in to keep a list.</p>
          <Button asChild>
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-neutral-900 mb-8">Saved events</h1>

        {isLoading || authLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-neutral-500">
            <Bookmark className="h-10 w-10 mx-auto mb-4 text-neutral-300" />
            <p className="text-lg mb-1">Nothing saved yet</p>
            <p className="text-sm">Use the save button on any event to keep it here.</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
