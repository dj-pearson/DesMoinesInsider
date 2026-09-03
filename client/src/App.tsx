import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import EventPage from "@/pages/event";
import PlacePage from "@/pages/place";
import NeighborhoodsPage from "@/pages/neighborhoods";
import NeighborhoodPage from "@/pages/neighborhood";
import ThisWeekendPage from "@/pages/this-weekend";
import GuidesPage from "@/pages/guides";
import GuidePage from "@/pages/guide";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/events/:slug" component={EventPage} />
      <Route path="/this-weekend" component={ThisWeekendPage} />
      <Route path="/guides" component={GuidesPage} />
      <Route path="/guides/:slug" component={GuidePage} />
      <Route path="/neighborhoods" component={NeighborhoodsPage} />
      <Route path="/neighborhoods/:slug" component={NeighborhoodPage} />
      <Route path="/restaurants/:slug">{() => <PlacePage kind="restaurants" />}</Route>
      <Route path="/attractions/:slug">{() => <PlacePage kind="attractions" />}</Route>
      <Route path="/playgrounds/:slug">{() => <PlacePage kind="playgrounds" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
