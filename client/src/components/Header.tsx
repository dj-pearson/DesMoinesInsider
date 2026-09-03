import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bookmark, Menu, User as UserIcon, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a
              href="/"
              className="text-2xl font-bold text-primary"
              aria-label="Des Moines Insider home"
            >
              Des Moines Insider
            </a>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <a href="/this-weekend" className="text-neutral-500 hover:text-primary transition-colors">This Weekend</a>
            <a href="#events" className="text-neutral-500 hover:text-primary transition-colors">Events</a>
            <a href="/neighborhoods" className="text-neutral-500 hover:text-primary transition-colors">Neighborhoods</a>
            <a href="/family" className="text-neutral-500 hover:text-primary transition-colors">Family</a>
            <a href="/guides" className="text-neutral-500 hover:text-primary transition-colors">Guides</a>
            <a href="/openings" className="text-neutral-500 hover:text-primary transition-colors">Openings</a>
            <a href="#attractions" className="text-neutral-500 hover:text-primary transition-colors">Attractions</a>
            <a href="#about" className="text-neutral-500 hover:text-primary transition-colors">About</a>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:inline-flex">
                    <UserIcon className="h-4 w-4 mr-2" />
                    {user.username}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href="/saved">
                      <Bookmark className="h-4 w-4 mr-2" />
                      Saved
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/account">Account</a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => logout()}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" asChild>
                <a href="/signin">Sign in</a>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <nav className="flex flex-col space-y-2">
              <a href="/this-weekend" className="text-neutral-500 hover:text-primary transition-colors py-2">This Weekend</a>
              <a href="#events" className="text-neutral-500 hover:text-primary transition-colors py-2">Events</a>
              <a href="/neighborhoods" className="text-neutral-500 hover:text-primary transition-colors py-2">Neighborhoods</a>
              <a href="/family" className="text-neutral-500 hover:text-primary transition-colors py-2">Family</a>
              <a href="/guides" className="text-neutral-500 hover:text-primary transition-colors py-2">Guides</a>
              {user ? (
                <>
                  <a href="/saved" className="text-neutral-500 hover:text-primary transition-colors py-2">Saved</a>
                  <a href="/account" className="text-neutral-500 hover:text-primary transition-colors py-2">Account</a>
                </>
              ) : (
                <a href="/signin" className="text-neutral-500 hover:text-primary transition-colors py-2">Sign in</a>
              )}
              <a href="/openings" className="text-neutral-500 hover:text-primary transition-colors py-2">Openings</a>
              <a href="#attractions" className="text-neutral-500 hover:text-primary transition-colors py-2">Attractions</a>
              <a href="#about" className="text-neutral-500 hover:text-primary transition-colors py-2">About</a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
