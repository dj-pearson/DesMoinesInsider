import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useSeo } from "@/lib/seo";
import type { Neighborhood } from "@shared/schema";

export default function AccountPage() {
  const { user, isLoading, refresh } = useAuth();
  const [homeNeighborhoodId, setHomeNeighborhoodId] = useState("none");
  const { toast } = useToast();

  useSeo({ title: "Account", canonicalPath: "/account", noIndex: true });

  // Seed the control once the user has loaded.
  useEffect(() => {
    if (user) setHomeNeighborhoodId(user.homeNeighborhoodId ?? "none");
  }, [user?.homeNeighborhoodId]);

  const { data: neighborhoods } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
  });

  const groups = [
    { label: "Des Moines districts", kind: "district" },
    { label: "Des Moines neighborhoods", kind: "neighborhood" },
    { label: "Suburbs", kind: "suburb" },
  ]
    .map((g) => ({ ...g, items: (neighborhoods ?? []).filter((n) => n.kind === g.kind) }))
    .filter((g) => g.items.length > 0);

  const save = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/me", {
        homeNeighborhoodId: homeNeighborhoodId === "none" ? null : homeNeighborhoodId,
      }),
    onSuccess: () => {
      refresh();
      toast({ title: "Saved" });
    },
    onError: () => toast({ title: "Could not save that", variant: "destructive" }),
  });

  if (!isLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-md mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Account</h1>
          <p className="text-neutral-600 mb-6">Sign in to manage your account.</p>
          <Button asChild><Link href="/signin">Sign in</Link></Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-neutral-900 mb-8">Account</h1>

        {user && (
          <dl className="mb-8 text-sm">
            <dt className="font-semibold text-neutral-900">Username</dt>
            <dd className="text-neutral-600 mb-3">{user.username}</dd>
            <dt className="font-semibold text-neutral-900">Email</dt>
            <dd className="text-neutral-600">{user.email}</dd>
          </dl>
        )}

        <div className="pt-6 border-t">
          <Label htmlFor="home">Home neighborhood</Label>
          <p className="text-sm text-neutral-500 mb-3">
            The home page leads with what is on near you.
          </p>
          <Select value={homeNeighborhoodId} onValueChange={setHomeNeighborhoodId}>
            <SelectTrigger id="home"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No preference</SelectItem>
              {groups.map((group) => (
                <SelectGroup key={group.kind}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.items.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button className="mt-4" onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
