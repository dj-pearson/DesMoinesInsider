import { useEffect, useRef, useState } from "react";
import { OPENING_STATUS_META } from "@shared/openingStatus";
import type { OpeningStatus, RestaurantOpening } from "@shared/schema";

/**
 * Leaflet map of openings and closings, pinned by status colour.
 *
 * Leaflet is loaded from a CDN on demand rather than bundled, so the ~150KB
 * only costs the people who open this page. If the CDN is unreachable the
 * component renders nothing and the list below it still works: a map is a nice
 * addition, not the content.
 */

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

/** Downtown Des Moines, used when nothing has coordinates yet. */
const METRO_CENTER: [number, number] = [41.5868, -93.625];

declare global {
  interface Window {
    L?: any;
  }
}

function loadOnce(): Promise<void> {
  if (window.L) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${LEAFLET_JS}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("leaflet failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("leaflet failed"));
    document.head.appendChild(script);
  });
}

export default function OpeningsMap({ openings }: { openings: RestaurantOpening[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  const pinned = openings.filter(
    (o) => typeof o.lat === "number" && typeof o.lng === "number",
  );

  useEffect(() => {
    let cancelled = false;

    loadOnce()
      .then(() => {
        if (cancelled || !containerRef.current || !window.L) return;

        if (!mapRef.current) {
          mapRef.current = window.L.map(containerRef.current).setView(METRO_CENTER, 11);
          window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
          }).addTo(mapRef.current);
        }

        const map = mapRef.current;
        // Clear old markers before redrawing for the current tab.
        map.eachLayer((layer: any) => {
          if (layer instanceof window.L.CircleMarker) map.removeLayer(layer);
        });

        const points: Array<[number, number]> = [];
        for (const opening of pinned) {
          const meta = OPENING_STATUS_META[opening.status as OpeningStatus];
          const marker = window.L.circleMarker([opening.lat, opening.lng], {
            radius: 9,
            color: "#ffffff",
            weight: 2,
            fillColor: meta?.pinColor ?? "#3b82f6",
            fillOpacity: 0.95,
          }).addTo(map);

          marker.bindPopup(
            `<strong>${opening.name}</strong><br/>${meta?.label ?? opening.status}` +
              (opening.slug ? `<br/><a href="/openings/${opening.slug}">Details</a>` : ""),
          );
          points.push([opening.lat as number, opening.lng as number]);
        }

        if (points.length > 0) {
          map.fitBounds(window.L.latLngBounds(points).pad(0.2), { maxZoom: 14 });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pinned.map((o) => `${o.id}:${o.status}`).join(",")]);

  // Nothing to show, or the library could not load: the list is the fallback.
  if (failed || pinned.length === 0) return null;

  return (
    <div className="mb-10">
      <div
        ref={containerRef}
        className="w-full h-80 rounded-xl overflow-hidden border border-neutral-200"
        aria-label="Map of restaurant openings and closings"
      />
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
        {Object.entries(OPENING_STATUS_META).map(([status, meta]) => (
          <span key={status} className="inline-flex items-center text-xs text-neutral-600">
            <span
              className="w-3 h-3 rounded-full mr-1.5 border border-white"
              style={{ backgroundColor: meta.pinColor }}
            />
            {meta.label}
          </span>
        ))}
      </div>
    </div>
  );
}
