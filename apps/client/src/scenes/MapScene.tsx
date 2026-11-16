import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { useArt } from "../art/ArtContext.js";
import type { MapGeometry, PieceName, Rect } from "../art/types.js";
import { PictureLayers } from "../components/Picture.js";
import { Plaques } from "../components/Plaques.js";
import { RichText } from "../components/RichText.js";
import { TownStrip } from "../components/TownStrip.js";
import { useT } from "../i18n/I18nContext.js";
import { FallbackMap } from "./FallbackMap.js";
import { hotspotBox, isExpandedTown, mapRects, pinBox } from "./mapData.js";
import type { SceneProps } from "./types.js";

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(3)}%`;

/** True for a spot in the map's top row: its label goes under it (above, the frame cut it off). */
const nearTop = (r: Rect, vb: [number, number, number, number]) => (r.y - vb[1]) / vb[3] < 0.12;

/** A building's box as a share of the map picture. */
function buildingBox(r: Rect, vb: [number, number, number, number]): CSSProperties {
  return {
    left: pct(r.x - vb[0], vb[2]),
    top: pct(r.y - vb[1], vb[3]),
    width: pct(r.w, vb[2]),
    height: pct(r.h, vb[3]),
  };
}

/** The places as a list of plaques (beside the map, under it on a phone, or opened over it). */
function PlaceList({
  places,
  visit,
  id,
  popover = false,
}: {
  places: { id: string; label: string }[];
  visit: (placeId: string) => void;
  id?: string;
  popover?: boolean;
}) {
  const t = useT();
  return (
    <nav
      id={id}
      className="fq-map-list fq-surface-dark"
      aria-label={t("map.places")}
      data-many={places.length > 10 ? "" : undefined}
      data-popover={popover ? "" : undefined}
    >
      <ul>
        {places.map((p) => (
          <li key={p.id}>
            <button type="button" className="fq-listbtn" onClick={() => visit(p.id)}>
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * In the 1024 x 745 layout the map takes the whole stage and there is no room for the list of
 * places beside it: a town with many places (an Expanded one, twenty) gets a Places button that
 * opens the list over the map's corner. Escape, the button again, or a place closes it.
 */
function PlacesButton({
  places,
  visit,
}: {
  places: { id: string; label: string }[];
  visit: (placeId: string) => void;
}) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  return (
    <div className="fq-map-places">
      <button
        ref={button}
        type="button"
        className="fq-map-places-btn"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" className="fq-map-places-icon">
          ☰
        </span>
        {t("map.placesButton")}
      </button>
      {open && <PlaceList places={places} visit={visit} id={id} popover />}
    </div>
  );
}

/** Full-frame Deathville map with a hot-spot per building. Sends `visit` actions. */
export function MapScene({ view, layout, onPress, onAction }: SceneProps) {
  const t = useT();
  const art = useArt();
  const places = view.map ?? [];
  const visit = (placeId: string) => onAction({ type: "visit", placeId });
  const ids = places.map((p) => p.id);
  // The 2001 map, or for an Expanded town the larger map when the pack has one (the town grown
  // round the 2001 map, every place at the originals' size).
  const original = art.piece("deathville-map-base") ? art.pack.map : undefined;
  const larger = art.pack.expandedMap;
  const largerUrl = art.piece("deathville-map-expanded-base");
  const useLarger =
    original !== undefined &&
    larger !== undefined &&
    largerUrl !== undefined &&
    isExpandedTown(ids, original.buildings);
  const baseUrl = useLarger ? largerUrl : art.piece("deathville-map-base");
  const geometry: MapGeometry | undefined = useLarger ? larger : original;
  const rects: Record<string, Rect> = useLarger
    ? larger.buildings
    : original
      ? mapRects(ids, original.buildings, original.expanded)
      : {};
  const frameStyle = useLarger
    ? ({ "--map-ratio": (larger.viewBox[2] / larger.viewBox[3]).toFixed(4) } as CSSProperties)
    : undefined;
  return (
    <div
      className="fq-map"
      data-art-map={geometry ? "pieces" : undefined}
      data-map={useLarger ? "expanded" : undefined}
    >
      <h1 className="fq-sr">{view.title}</h1>
      {view.town && <TownStrip town={view.town} variant="map" />}
      <div className="fq-map-frame" style={frameStyle}>
        <div className="fq-map-art">
          {geometry && baseUrl ? (
            <img className="fq-map-base" src={baseUrl} alt="" draggable={false} />
          ) : (
            <FallbackMap />
          )}
          <PictureLayers picture={view.picture} quiet />
          {!geometry && (
            <p className="fq-map-title" aria-hidden="true">
              {t("map.title")}
            </p>
          )}
          <ul
            className="fq-hotspots"
            aria-label={t("map.places")}
            data-many={places.length > 10 ? "" : undefined}
          >
            {places.map((p, i) => {
              const rect = rects[p.id];
              const building = rect ? art.piece(`building-${p.id}` as PieceName) : undefined;
              if (geometry && rect && building) {
                return (
                  <li key={p.id} style={buildingBox(rect, geometry.viewBox)}>
                    <button
                      type="button"
                      className="fq-hotspot fq-hotspot-building"
                      data-edge={nearTop(rect, geometry.viewBox) ? "top" : undefined}
                      onClick={() => visit(p.id)}
                      aria-label={t("map.visit", { place: p.label })}
                    >
                      <img className="fq-building" src={building} alt="" draggable={false} />
                      <span className="fq-hotspot-label" aria-hidden="true">
                        {p.label}
                      </span>
                    </button>
                  </li>
                );
              }
              // A place that is part of the base map's own drawing (the graveyard): a hot-spot
              // over the picture, with its label on hover.
              if (geometry && rect && !building) {
                return (
                  <li key={p.id} style={buildingBox(rect, geometry.viewBox)}>
                    <button
                      type="button"
                      className="fq-hotspot fq-hotspot-area"
                      data-edge={nearTop(rect, geometry.viewBox) ? "top" : undefined}
                      onClick={() => visit(p.id)}
                      aria-label={t("map.visit", { place: p.label })}
                    >
                      <span className="fq-hotspot-label" aria-hidden="true">
                        {p.label}
                      </span>
                    </button>
                  </li>
                );
              }
              // A place the art does not know (or a pack without map art): a visible pin.
              const known = !geometry && hotspotBox(p.id, i, places.length, true);
              return (
                <li key={p.id} style={known || pinBox(i, places.length)}>
                  <button
                    type="button"
                    className={known ? "fq-hotspot" : "fq-hotspot fq-hotspot-pin"}
                    onClick={() => visit(p.id)}
                    aria-label={t("map.visit", { place: p.label })}
                  >
                    <span
                      className={known ? "fq-hotspot-label" : "fq-pin-label"}
                      aria-hidden="true"
                    >
                      {p.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {layout !== "classic" && <PlaceList places={places} visit={visit} />}
      {layout === "classic" && places.length > 10 && <PlacesButton places={places} visit={visit} />}
      {view.text.length > 0 && (
        <p className="fq-map-caption fq-surface-dark">
          <RichText spans={view.text} />
        </p>
      )}
      <div className="fq-map-buttons">
        <Plaques buttons={view.buttons} onPress={onPress} />
      </div>
    </div>
  );
}
