import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, Send } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useSeo } from "@/lib/seo";
import { EVENT_CATEGORIES } from "@shared/schema";

interface FormState {
  title: string;
  description: string;
  date: string;
  location: string;
  venue: string;
  category: string;
  price: string;
  sourceUrl: string;
  submitterName: string;
  submitterEmail: string;
  /** Honeypot. Hidden from people; bots fill it in. */
  website: string;
}

const EMPTY: FormState = {
  title: "",
  description: "",
  date: "",
  location: "",
  venue: "",
  category: "",
  price: "",
  sourceUrl: "",
  submitterName: "",
  submitterEmail: "",
  website: "",
};

export default function SubmitPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useSeo({
    title: "Add Your Event",
    description:
      "Submit an event to Des Moines Insider. Open to any venue, organizer or neighbor, not just paying members.",
    canonicalPath: "/submit",
  });

  const set = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        ...form,
        // Optional fields go as null rather than empty strings so the URL
        // validation does not reject a blank box.
        venue: form.venue.trim() || null,
        price: form.price.trim() || null,
        sourceUrl: form.sourceUrl.trim() || null,
        date: form.date ? new Date(form.date).toISOString() : "",
      };
      return apiRequest("POST", "/api/submissions", payload);
    },
    onSuccess: () => {
      setSubmitted(true);
      setFieldErrors({});
    },
    onError: async (error: any) => {
      // The API returns per-field messages; surface them next to the inputs.
      const match = /\{[\s\S]*\}/.exec(error?.message ?? "");
      if (match) {
        try {
          const body = JSON.parse(match[0]);
          if (Array.isArray(body.issues)) {
            setFieldErrors(
              Object.fromEntries(
                body.issues.map((i: { field: string; message: string }) => [
                  i.field,
                  i.message,
                ]),
              ),
            );
          }
        } catch {
          /* fall through to the toast */
        }
      }
      toast({
        title: "Check the form",
        description: "Some details need fixing before we can accept this.",
        variant: "destructive",
      });
    },
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <Check className="h-12 w-12 mx-auto mb-4 text-accent" />
          <h1 className="text-3xl font-bold text-neutral-900 mb-3">Thanks</h1>
          <p className="text-neutral-600 mb-8">
            We read every submission. If it fits, it will appear on the site
            shortly.
          </p>
          <Button asChild>
            <Link href="/">Back to the site</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const err = (field: string) =>
    fieldErrors[field] ? (
      <p className="text-sm text-red-600 mt-1">{fieldErrors[field]}</p>
    ) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
          Add your event
        </h1>
        <p className="text-lg text-neutral-500 mb-10">
          Open to anyone: venues, organizers, food trucks, block parties. You do
          not need to be a member of anything. We review every submission before
          it goes up.
        </p>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {/* Honeypot. Hidden from people, and bots that fill everything in
              give themselves away. Not display:none, which some bots skip. */}
          <div className="absolute left-[-9999px]" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="title">Event name *</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
            {err("title")}
          </div>

          <div>
            <Label htmlFor="description">What is it? *</Label>
            <Textarea
              id="description"
              required
              rows={4}
              placeholder="A couple of sentences. What happens, who it is for."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
            {err("description")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="date">Date and time *</Label>
              <Input
                id="date"
                type="datetime-local"
                required
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
              {err("date")}
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err("category")}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                value={form.venue}
                onChange={(e) => set("venue", e.target.value)}
              />
              {err("venue")}
            </div>
            <div>
              <Label htmlFor="location">Neighborhood or city *</Label>
              <Input
                id="location"
                required
                placeholder="East Village, Ankeny, Beaverdale…"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
              {err("location")}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                placeholder="Free, $10, $15-25…"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
              {err("price")}
            </div>
            <div>
              <Label htmlFor="sourceUrl">Link for details</Label>
              <Input
                id="sourceUrl"
                type="url"
                placeholder="https://"
                value={form.sourceUrl}
                onChange={(e) => set("sourceUrl", e.target.value)}
              />
              {err("sourceUrl")}
            </div>
          </div>

          <div className="pt-6 border-t grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="submitterName">Your name *</Label>
              <Input
                id="submitterName"
                required
                value={form.submitterName}
                onChange={(e) => set("submitterName", e.target.value)}
              />
              {err("submitterName")}
            </div>
            <div>
              <Label htmlFor="submitterEmail">Your email *</Label>
              <Input
                id="submitterEmail"
                type="email"
                required
                value={form.submitterEmail}
                onChange={(e) => set("submitterEmail", e.target.value)}
              />
              {err("submitterEmail")}
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            We only use your details to follow up on this submission.
          </p>

          <Button type="submit" size="lg" disabled={mutation.isPending}>
            <Send className="h-4 w-4 mr-2" />
            {mutation.isPending ? "Sending…" : "Submit event"}
          </Button>
        </form>
      </div>

      <Footer />
    </div>
  );
}
