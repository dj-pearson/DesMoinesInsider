import { useState } from "react";
import Header from "@/components/Header";
import SearchSection from "@/components/SearchSection";
import FeaturedEvents from "@/components/FeaturedEvents";
import MostSearched from "@/components/MostSearched";
import EventFilters from "@/components/EventFilters";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";
import { RestaurantOpenings } from "@/components/RestaurantOpenings";
import ComingUp from "@/components/ComingUp";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSeo } from "@/lib/seo";
import { useToast } from "@/hooks/use-toast";
import { Attraction, Event, Playground, Restaurant } from "@shared/schema";
import { Calendar, MapPin, Search as SearchIcon } from "lucide-react";
import { format } from "date-fns";

interface SearchResults {
  events: Event[];
  restaurants: Restaurant[];
  attractions: Attraction[];
  playgrounds: Playground[];
}

export default function Home() {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useSeo({
    title: "Des Moines Insider",
    description:
      "Events, new restaurant openings, playgrounds and things to do across the Des Moines metro, written for people who live here.",
    canonicalPath: "/",
  });

  const handleSearch = async (query: string, category: string) => {
    if (!query.trim()) {
      toast({
        title: "Empty search",
        description: "Please enter a search term",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);

    try {
      const params = new URLSearchParams({ q: query });
      if (category !== "All Categories") {
        params.append('category', category);
      }

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const results = await response.json();
      setSearchResults(results);
      setShowAllEvents(false); // Hide the all events view when showing search results

      // Scroll to results
      setTimeout(() => {
        document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      const totalResults = results.events.length + results.restaurants.length +
                           results.attractions.length + results.playgrounds.length;

      toast({
        title: "Search completed",
        description: `Found ${totalResults} result${totalResults !== 1 ? 's' : ''} for "${query}"`,
      });
    } catch (error) {
      toast({
        title: "Search failed",
        description: "Failed to search. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchResults(null);
    setSearchQuery("");
  };

  const handleViewAllEvents = () => {
    setShowAllEvents(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SearchSection onSearch={handleSearch} isSearching={isSearching} />

      {/* Search Results Section */}
      {searchResults && (
        <section id="search-results" className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-3xl font-bold text-neutral-900 mb-2">Search Results</h3>
                <p className="text-lg text-neutral-500">
                  Results for "{searchQuery}"
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleClearSearch}
              >
                Clear Search
              </Button>
            </div>

            {/* Events Results */}
            {searchResults.events.length > 0 && (
              <div className="mb-12">
                <h4 className="text-2xl font-semibold text-neutral-900 mb-6 flex items-center">
                  <Calendar className="h-6 w-6 mr-2 text-primary" />
                  Events ({searchResults.events.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.events.map((event) => (
                    <Link
                      key={event.id}
                      href={event.slug ? `/events/${event.slug}` : "#"}
                      className="block bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {event.imageUrl && (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-48 object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="p-4">
                        <h5 className="text-lg font-semibold text-neutral-900 mb-2">
                          {event.title}
                        </h5>
                        <div className="flex items-center text-sm text-neutral-600 mb-2">
                          <Calendar className="h-4 w-4 mr-1" />
                          {format(new Date(event.date), "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center text-sm text-neutral-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          {event.location}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Restaurants Results */}
            {searchResults.restaurants.length > 0 && (
              <div className="mb-12">
                <h4 className="text-2xl font-semibold text-neutral-900 mb-6">
                  Restaurants ({searchResults.restaurants.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.restaurants.map((restaurant) => (
                    <Link
                      key={restaurant.id}
                      href={restaurant.slug ? `/restaurants/${restaurant.slug}` : "#"}
                      className="block bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                    >
                      <h5 className="text-lg font-semibold text-neutral-900 mb-2">
                        {restaurant.name}
                      </h5>
                      <p className="text-sm text-neutral-600">{restaurant.cuisine}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Attractions Results */}
            {searchResults.attractions.length > 0 && (
              <div className="mb-12">
                <h4 className="text-2xl font-semibold text-neutral-900 mb-6">
                  Attractions ({searchResults.attractions.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.attractions.map((attraction) => (
                    <Link
                      key={attraction.id}
                      href={attraction.slug ? `/attractions/${attraction.slug}` : "#"}
                      className="block bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                    >
                      <h5 className="text-lg font-semibold text-neutral-900 mb-2">
                        {attraction.name}
                      </h5>
                      <p className="text-sm text-neutral-600">{attraction.type}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Playgrounds Results */}
            {searchResults.playgrounds.length > 0 && (
              <div className="mb-12">
                <h4 className="text-2xl font-semibold text-neutral-900 mb-6">
                  Playgrounds ({searchResults.playgrounds.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.playgrounds.map((playground) => (
                    <Link
                      key={playground.id}
                      href={playground.slug ? `/playgrounds/${playground.slug}` : "#"}
                      className="block bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                    >
                      <h5 className="text-lg font-semibold text-neutral-900 mb-2">
                        {playground.name}
                      </h5>
                      <p className="text-sm text-neutral-600">{playground.features}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {searchResults.events.length === 0 &&
              searchResults.restaurants.length === 0 &&
              searchResults.attractions.length === 0 &&
              searchResults.playgrounds.length === 0 && (
                <div className="text-center py-12">
                  <SearchIcon className="h-16 w-16 mx-auto mb-4 text-neutral-300" />
                  <p className="text-lg text-neutral-600 mb-2">No results found</p>
                  <p className="text-sm text-neutral-500">
                    Try searching with different keywords
                  </p>
                </div>
              )}
          </div>
        </section>
      )}

      {!showAllEvents && !searchResults && (
        <>
          <ComingUp />
          <FeaturedEvents onViewAllEvents={handleViewAllEvents} />
          <MostSearched />
          
          {/* Restaurant Openings Section */}
          <section className="py-16 bg-muted/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <RestaurantOpenings />
            </div>
          </section>
        </>
      )}
      
      {showAllEvents && (
        <div className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setShowAllEvents(false)}
              >
                ← Back to Featured
              </Button>
            </div>
          </div>
          <EventFilters />
        </div>
      )}
      
      <Newsletter />
      <Footer />

    </div>
  );
}
