import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Baby, Calendar, Footprints, Home, MapPin, Ticket, Users } from "lucide-react";
import { Event } from "@shared/schema";
import { format } from "date-fns";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const formatDate = (date: string | Date) => {
    try {
      return format(new Date(date), "MMM d, yyyy");
    } catch {
      return "Date TBA";
    }
  };

  const getCategoryColor = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes("music")) return "bg-accent text-white";
    if (categoryLower.includes("food")) return "bg-accent text-white";
    if (categoryLower.includes("art")) return "bg-secondary text-white";
    return "bg-primary text-white";
  };

  // Slugs are generated on insert and backfilled at boot, so this is defensive.
  // Without one there is no page to link to, so the card stays inert.
  const href = event.slug ? `/events/${event.slug}` : null;

  const body = (
    <>
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-48 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="p-6">
        <div className="flex items-center mb-2">
          <Badge className={getCategoryColor(event.category)}>{event.category}</Badge>
          <span className="ml-auto text-neutral-500 text-sm flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {formatDate(event.date)}
          </span>
        </div>
        <h4 className="text-xl font-bold mb-2">{event.title}</h4>
        {/* Only true flags show. An unknown flag stays silent rather than
            rendering as a confident negative. */}
        {(event.isFree || event.isKidFriendly || event.isIndoor ||
          event.isSkywalkAccessible || event.source === "community") && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {event.isFree && (
              <Badge variant="secondary" className="text-xs font-medium">
                <Ticket className="h-3 w-3 mr-1" />
                Free
              </Badge>
            )}
            {event.isKidFriendly && (
              <Badge variant="secondary" className="text-xs font-medium">
                <Baby className="h-3 w-3 mr-1" />
                Kid-friendly
              </Badge>
            )}
            {event.isIndoor && (
              <Badge variant="secondary" className="text-xs font-medium">
                <Home className="h-3 w-3 mr-1" />
                Indoor
              </Badge>
            )}
            {event.source === "community" && (
              <Badge variant="secondary" className="text-xs font-medium">
                <Users className="h-3 w-3 mr-1" />
                Community submitted
              </Badge>
            )}
            {event.isSkywalkAccessible && (
              <Badge variant="secondary" className="text-xs font-medium">
                <Footprints className="h-3 w-3 mr-1" />
                Skywalk
              </Badge>
            )}
          </div>
        )}
        <p className="text-neutral-500 mb-4 line-clamp-3">
          {event.enhancedDescription || event.originalDescription}
        </p>
        <div className="flex items-center text-neutral-500 mb-4">
          <MapPin className="h-4 w-4 mr-2" />
          <span>{event.location}</span>
        </div>
        {event.price && (
          <div className="text-sm text-neutral-600 mb-4">Price: {event.price}</div>
        )}
        <Button
          className="w-full bg-primary hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors"
          disabled={!href}
          // The whole card is already the link; this is a visual affordance.
          tabIndex={-1}
          asChild={false}
        >
          View Details
        </Button>
      </div>
    </>
  );

  const shell =
    "block bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow";

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link href={href} className={shell} aria-label={`View details for ${event.title}`}>
      {body}
    </Link>
  );
}
