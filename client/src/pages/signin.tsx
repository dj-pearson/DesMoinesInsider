import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useSeo } from "@/lib/seo";
import type { Neighborhood } from "@shared/schema";

export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [homeNeighborhoodId, setHomeNeighborhoodId] = useState("none");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const { toast } = useToast();

  useSeo({
    title: mode === "signin" ? "Sign in" : "Create an account",
    description:
      "Save events and set your home neighborhood on Des Moines Insider.",
    canonicalPath: "/signin",
    noIndex: true,
  });

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

  const submit = useMutation({
    mutationFn: async () => {
      const path = mode === "signin" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "signin"
          ? { username, password }
          : {
              username,
              email,
              password,
              homeNeighborhoodId:
                homeNeighborhoodId === "none" ? null : homeNeighborhoodId,
            };
      return apiRequest("POST", path, body);
    },
    onSuccess: () => {
      refresh();
      toast({ title: mode === "signin" ? "Signed in" : "Account created" });
      navigate("/");
    },
    onError: (err: any) => {
      // The server deliberately returns one message for bad credentials, so
      // there is nothing more specific to show here.
      setError(
        mode === "signin"
          ? "Those details do not match."
          : "Could not create that account. The username or email may be taken, and passwords need at least 10 characters.",
      );
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 max-w-md mx-auto px-4 py-16 w-full">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <p className="text-neutral-600 mb-8">
          Save events and set your home neighborhood so the site leads with your
          part of town.
        </p>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            submit.mutate();
          }}
        >
          <div>
            <Label htmlFor="username">
              {mode === "signin" ? "Username or email" : "Username"}
            </Label>
            <Input
              id="username"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {mode === "register" && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "register" && (
              <p className="text-xs text-neutral-500 mt-1">At least 10 characters.</p>
            )}
          </div>

          {mode === "register" && (
            <div>
              <Label htmlFor="home">Home neighborhood (optional)</Label>
              <Select value={homeNeighborhoodId} onValueChange={setHomeNeighborhoodId}>
                <SelectTrigger id="home">
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  {groups.map((group) => (
                    <SelectGroup key={group.kind}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.items.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={submit.isPending}>
            {submit.isPending
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-6 text-sm text-primary hover:underline"
          onClick={() => {
            setMode(mode === "signin" ? "register" : "signin");
            setError("");
          }}
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
      <Footer />
    </div>
  );
}
