import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Lock, X } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSeo } from "@/lib/seo";
import type { EventSubmission } from "@shared/schema";

/**
 * Review queue for community submissions.
 *
 * Authentication is the admin token, held in sessionStorage and sent as a
 * header. sessionStorage rather than localStorage so it does not outlive the
 * browser session. US-017 replaces this with a real admin session.
 */
const TOKEN_KEY = "dsm-admin-token";

function authHeaders(token: string): HeadersInit {
  return { "X-Admin-Token": token, "Content-Type": "application/json" };
}

export default function AdminSubmissionsPage() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) ?? "",
  );
  const [draftToken, setDraftToken] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useSeo({
    title: "Review submissions",
    // An admin tool has no business in search results.
    noIndex: true,
  });

  const { data: submissions, isLoading, error } = useQuery<EventSubmission[]>({
    queryKey: ["/api/submissions?status=pending", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/submissions?status=pending", {
        headers: authHeaders(token),
      });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const response = await fetch(`/api/submissions/${id}/${action}`, {
        method: "POST",
        headers: authHeaders(token),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions?status=pending", token] });
      toast({
        title: variables.action === "approve" ? "Published" : "Rejected",
        description:
          variables.action === "approve"
            ? "It is live and has been through the enhancer."
            : "Removed from the queue.",
      });
    },
    onError: () => {
      toast({ title: "That did not work", variant: "destructive" });
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-md mx-auto px-4 py-24 w-full">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2 flex items-center">
            <Lock className="h-5 w-5 mr-2" />
            Admin
          </h1>
          <p className="text-neutral-600 mb-6 text-sm">
            Enter the admin token to review submissions.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sessionStorage.setItem(TOKEN_KEY, draftToken);
              setToken(draftToken);
            }}
          >
            <Label htmlFor="token">Admin token</Label>
            <Input
              id="token"
              type="password"
              value={draftToken}
              onChange={(e) => setDraftToken(e.target.value)}
              className="mb-4"
            />
            <Button type="submit">Continue</Button>
          </form>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-baseline justify-between mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">Pending submissions</h1>
          <button
            type="button"
            className="text-sm text-neutral-500 hover:text-primary"
            onClick={() => {
              sessionStorage.removeItem(TOKEN_KEY);
              setToken("");
            }}
          >
            Sign out
          </button>
        </div>

        {error && (
          <p className="text-red-600 mb-6">
            That token was not accepted. Sign out and try again.
          </p>
        )}

        {isLoading && <p className="text-neutral-500">Loading…</p>}

        {submissions?.length === 0 && (
          <p className="text-neutral-500">Nothing waiting for review.</p>
        )}

        <div className="space-y-6">
          {(submissions ?? []).map((submission) => (
            <article
              key={submission.id}
              className="bg-white border border-neutral-200 rounded-xl p-6"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">
                    {submission.title}
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    {format(new Date(submission.date), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <Badge variant="secondary">{submission.category}</Badge>
              </div>

              <p className="text-neutral-700 mb-4">{submission.description}</p>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-neutral-600 mb-5">
                <div>
                  <dt className="inline font-semibold">Where: </dt>
                  <dd className="inline">
                    {submission.venue
                      ? `${submission.venue}, ${submission.location}`
                      : submission.location}
                  </dd>
                </div>
                {submission.price && (
                  <div>
                    <dt className="inline font-semibold">Price: </dt>
                    <dd className="inline">{submission.price}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline font-semibold">From: </dt>
                  <dd className="inline">
                    {submission.submitterName} ({submission.submitterEmail})
                  </dd>
                </div>
                {submission.sourceUrl && (
                  <div className="truncate">
                    <dt className="inline font-semibold">Link: </dt>
                    <dd className="inline">
                      <a
                        href={submission.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-primary hover:underline"
                      >
                        {submission.sourceUrl}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>

              <div className="flex gap-3">
                <Button
                  onClick={() => review.mutate({ id: submission.id, action: "approve" })}
                  disabled={review.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve and publish
                </Button>
                <Button
                  variant="outline"
                  onClick={() => review.mutate({ id: submission.id, action: "reject" })}
                  disabled={review.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
