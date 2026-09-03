import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Check } from "lucide-react";
import type { Neighborhood } from "@shared/schema";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("all");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  const { data: neighborhoods } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
  });

  const groups = [
    { label: "Des Moines districts", kind: "district" },
    { label: "Des Moines neighborhoods", kind: "neighborhood" },
    { label: "Suburbs", kind: "suburb" },
  ]
    .map((group) => ({
      ...group,
      items: (neighborhoods ?? []).filter((n) => n.kind === group.kind),
    }))
    .filter((group) => group.items.length > 0);

  const subscribeMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('POST', '/api/newsletter/subscribe', {
        email,
        // "all" is the default, meaning no preference rather than a place.
        neighborhoodId: neighborhoodId === "all" ? null : neighborhoodId,
      });
    },
    onSuccess: () => {
      setIsSubscribed(true);
      setEmail("");
      toast({
        title: "Almost there",
        description: "Check your inbox and click the link to confirm.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Subscription failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    subscribeMutation.mutate(email);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubscribe();
    }
  };

  if (isSubscribed) {
    return (
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-400 mr-2" />
            <h3 className="text-3xl font-bold">Thank You!</h3>
          </div>
          <p className="text-xl opacity-90">
            Check your email and click the confirmation link. We only send once you
            have confirmed.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-primary text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <Mail className="h-8 w-8 mr-2" />
          <h3 className="text-3xl font-bold">The Thursday email</h3>
        </div>
        <p className="text-xl mb-8 opacity-90">
          What is on this weekend across the metro, in your inbox every Thursday
          afternoon.
        </p>
        
        <div className="max-w-md mx-auto">
          <div className="flex gap-2">
            <Input 
              type="email" 
              placeholder="Enter your email" 
              className="flex-1 px-4 py-3 rounded-l-lg text-neutral-900 bg-white border-0 focus:ring-2 focus:ring-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={subscribeMutation.isPending}
            />
            <Button 
              className="bg-secondary hover:bg-red-700 px-6 py-3 rounded-r-lg font-semibold transition-colors"
              onClick={handleSubscribe}
              disabled={subscribeMutation.isPending}
            >
              {subscribeMutation.isPending ? "..." : "Subscribe"}
            </Button>
          </div>
          <div className="mt-3 text-left">
            <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
              <SelectTrigger className="w-full text-neutral-900 bg-white border-0">
                <SelectValue placeholder="Anywhere in the metro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anywhere in the metro</SelectItem>
                {groups.map((group) => (
                  <SelectGroup key={group.kind}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.items.map((neighborhood) => (
                      <SelectItem key={neighborhood.id} value={neighborhood.id}>
                        {neighborhood.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm mt-4 opacity-80">
            One email a week. Unsubscribe in one click, any time.
          </p>
        </div>
      </div>
    </section>
  );
}
