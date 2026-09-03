import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { TipTargetType, TipWithAuthor } from "@shared/schema";

const MAX_LENGTH = 280;

/**
 * "Locals say" — short advice left by residents on any event or place.
 *
 * Text only, deliberately. Accepting links here would turn the section into a
 * spam target and would need the same URL vetting the submission form does.
 */
export default function TipsList({
  targetType,
  targetId,
}: {
  targetType: TipTargetType;
  targetId: string;
}) {
  const [body, setBody] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const key = [`/api/tips/${targetType}/${targetId}`];

  const { data: tips } = useQuery<TipWithAuthor[]>({
    queryKey: key,
    retry: false,
  });

  const post = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/tips", { targetType, targetId, body: body.trim() }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: key });
      toast({ title: "Thanks for the tip" });
    },
    onError: (error: any) => {
      const alreadyPosted = String(error?.message ?? "").includes("already left");
      toast({
        title: alreadyPosted ? "You have already left a tip here" : "Could not post that",
        variant: "destructive",
      });
    },
  });

  const remaining = MAX_LENGTH - body.length;

  return (
    <section className="mt-12 pt-8 border-t">
      <h2 className="text-xl font-bold text-neutral-900 mb-1 flex items-center">
        <MessageSquare className="h-5 w-5 mr-2 text-primary" />
        Locals say
      </h2>
      <p className="text-sm text-neutral-500 mb-6">
        Short, practical advice from people who have been.
      </p>

      {tips && tips.length > 0 ? (
        <ul className="space-y-4 mb-8">
          {tips.map((tip) => (
            <li key={tip.id} className="bg-white border border-neutral-200 rounded-lg p-4">
              <p className="text-neutral-800">{tip.body}</p>
              <p className="text-xs text-neutral-500 mt-2">
                {tip.authorUsername}
                {tip.createdAt &&
                  ` · ${formatDistanceToNow(new Date(tip.createdAt), { addSuffix: true })}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 mb-8">
          No tips yet. If you have been, you know something worth passing on.
        </p>
      )}

      {user ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            post.mutate();
          }}
        >
          <Textarea
            rows={3}
            maxLength={MAX_LENGTH}
            placeholder="Where to park, when to arrive, what to skip…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center justify-between mt-2">
            <span
              className={`text-xs ${remaining < 20 ? "text-orange-600" : "text-neutral-500"}`}
            >
              {remaining} characters left
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={post.isPending || body.trim().length < 4}
            >
              Add tip
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-neutral-500">
          <Link href="/signin" className="text-primary hover:underline">
            Sign in
          </Link>{" "}
          to add a tip.
        </p>
      )}
    </section>
  );
}
