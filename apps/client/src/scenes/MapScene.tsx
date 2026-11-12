import type { CSSProperties } from "react";
import { useArt } from "../art/ArtContext.js";
import type { PieceName, Rect } from "../art/types.js";
import { PictureLayers } from "../components/Picture.js";
import { Plaques } from "../components/Plaques.js";
import { RichText } from "../components/RichText.js";
import { TownStrip } from "../components/TownStrip.js";
import { useT } from "../i18n/I18nContext.js";
import { FallbackMap } from "./FallbackMap.js";
import { hotspotBox, mapRects, pinBox } from "./mapData.js";
import type { SceneProps } from "./types.js";

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(3)}%`;

/** A building's box as a share of the map picture. */
function buildingBox(r: Rect, vb: [number, number, number, number]): CSSProperties {
  return {
    left: pct(r.x - vb[0], vb[2]),
    top: pct(r.y - vb[1], vb[3]),
    width: pct(r.w, vb[2]),
    height: pct(r.h, vb[3]),
  };
}

/** Full-frame Deathville map with a hot-spot per building. Sends `visit` actions. */
export function MapScene({ view, layout, onPress, onAction }: SceneProps) {
  const t = useT();
  const art = useArt();
  const places = view.map ?? [];
  const visit = (placeId: string) => onAction({ type: "visit", placeId });
  const baseUrl = art.piece("deathville-map-base");
  const geometry = baseUrl ? art.pack.map : undefined;
  const rects = geometry
    ? mapRects(
        places.map((p) => p.id),
        geometry.buildings,
        geometry.expanded,
      )
    : {};
  return (
    <div className="fq-map" data-art-map={geometry ? "pieces" : undefined}>
      <h1 className="fq-sr">{view.title}</h1>
      {view.town && <TownStrip town={view.town} variant="map" />}
      <div className="fq-map-frame">
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
      {layout !== "classic" && (
        <nav
          className="fq-map-list fq-surface-dark"
          aria-label={t("map.places")}
          data-many={places.length > 10 ? "" : undefined}
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
      )}
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
