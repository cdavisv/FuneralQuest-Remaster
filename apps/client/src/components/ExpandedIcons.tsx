import type { ReactNode } from "react";
import { useArtMaybe } from "../art/ArtContext.js";
import { ICON_NAMES, type IconName as PackIconName } from "../art/types.js";

/**
 * Small inline icons for the Expanded ledger and town strip. Drawn here, in the same flat
 * two-tone vector style as the rest of the chrome, so they are original art that needs no
 * licence. All are decorative: the caller names the control.
 */
function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="fq-xicon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export type IconName =
  | "turns"
  | "money"
  | "karma"
  | "rating"
  | "savings"
  | "debt"
  | "injuries"
  | "leads"
  | "clear"
  | "rain"
  | "fog"
  | "thunderstorm"
  | "scorcher"
  | "snow"
  | "weather"
  | "news"
  | "ordinance"
  | "mayor"
  | "story"
  | "vote"
  | "chevron";

const PACK_ICONS = new Set<string>(ICON_NAMES);

/** An icon: the art pack's drawing when it has one (Remastered), else the inline glyph. */
export function XIcon({ name }: { name: IconName }) {
  const art = useArtMaybe();
  const src = PACK_ICONS.has(name) ? art?.icon(name as PackIconName) : undefined;
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        width={24}
        height={24}
        className="fq-xicon fq-xicon-art"
      />
    );
  }
  return <XGlyph name={name} />;
}

/** The client's own inline glyphs (stroked in the text colour). */
export function XGlyph({ name }: { name: IconName }) {
  switch (name) {
    case "turns":
      return (
        <Svg>
          <path d="M7 3h10M7 21h10M8 3c0 5 3 6 4 9-1 3-4 4-4 9M16 3c0 5-3 6-4 9 1 3 4 4 4 9" />
        </Svg>
      );
    case "money":
      return (
        <Svg>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M14.5 9c-.6-1-1.6-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1.1 1.7 2.7 2.1c1.6.4 2.7.9 2.7 2.1s-1.1 2-2.7 2c-1.1 0-2.2-.5-2.8-1.5M12 6v1.6M12 16.4V18" />
        </Svg>
      );
    case "karma":
      return (
        <Svg>
          <path d="M12 4v14M5 8h14M7 8l-3 6c0 1.7 1.3 2.5 3 2.5s3-.8 3-2.5zM17 8l-3 6c0 1.7 1.3 2.5 3 2.5s3-.8 3-2.5zM8 20h8" />
        </Svg>
      );
    case "rating":
      return (
        <Svg>
          <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z" />
        </Svg>
      );
    case "savings":
      return (
        <Svg>
          <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 8.8v1.2M12 14v1.2M7 19v1.5M17 19v1.5" />
        </Svg>
      );
    case "debt":
      return (
        <Svg>
          <path d="M6 3.5h10.5a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6zM6 3.5v17M9.5 8h5M9.5 12h5M9.5 16h3" />
        </Svg>
      );
    case "injuries":
      return (
        <Svg>
          <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" />
          <path d="M10.5 10.5l3 3M12 9l3 3M9 12l3 3" />
        </Svg>
      );
    case "leads":
      return (
        <Svg>
          <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
          <path d="M3.5 10h17M7 14h4" />
        </Svg>
      );
    case "clear":
      return (
        <Svg>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
        </Svg>
      );
    case "rain":
      return (
        <Svg>
          <path d="M7 14.5a4 4 0 0 1-.4-8 5.2 5.2 0 0 1 10 1.2 3.6 3.6 0 0 1-.6 6.8zM8.5 17l-1 2.5M12.5 17l-1 2.5M16.5 17l-1 2.5" />
        </Svg>
      );
    case "fog":
      return (
        <Svg>
          <path d="M7 11a4 4 0 0 1 .4-6 5 5 0 0 1 9.4 1.2A3.4 3.4 0 0 1 17 11zM3.5 14h17M5.5 17.2h13M8 20.4h8" />
        </Svg>
      );
    case "thunderstorm":
      return (
        <Svg>
          <path d="M7 13.5a4 4 0 0 1-.4-7.8 5.2 5.2 0 0 1 10 1.2 3.4 3.4 0 0 1-.6 6.6M12.8 10.5l-2.6 4.2h3.4l-2.2 4.3" />
        </Svg>
      );
    case "scorcher":
      return (
        <Svg>
          <path d="M12 3c2 3.4 5.5 5.2 5.5 9.4A5.5 5.5 0 0 1 12 18a5.5 5.5 0 0 1-5.5-5.6c0-2.2 1.2-3.4 2.2-4.6.3 1.6 1 2.2 1.8 2.6C10.2 7.6 10.6 5.4 12 3zM9.5 21h5" />
        </Svg>
      );
    case "snow":
      return (
        <Svg>
          <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2" />
        </Svg>
      );
    case "weather":
      return (
        <Svg>
          <path d="M7 17a4 4 0 0 1-.4-8 5.2 5.2 0 0 1 10 1.2A3.4 3.4 0 0 1 16.8 17z" />
        </Svg>
      );
    case "news":
      return (
        <Svg>
          <path d="M5 4.5h11a1.5 1.5 0 0 1 1.5 1.5v13.5H7A2 2 0 0 1 5 17.5zM17.5 8H20v9.5a2 2 0 0 1-2 2M8 8h6M8 11.2h6M8 14.4h4" />
        </Svg>
      );
    case "ordinance":
      return (
        <Svg>
          <path d="M4 20h9M9.5 15.5l-4 4M14 4.5l5.5 5.5M11.5 7l5.5 5.5M8 10.5l5.5 5.5M14.2 4.4L8 10.6l5.4 5.4 6.2-6.2z" />
        </Svg>
      );
    case "mayor":
      return (
        <Svg>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6M9 14l3 4 3-4" />
        </Svg>
      );
    case "story":
      return (
        <Svg>
          <path d="M4 5.5C7 4 10 4.4 12 6c2-1.6 5-2 8-.5v13c-3-1.5-6-1-8 .5-2-1.5-5-2-8-.5zM12 6v13" />
        </Svg>
      );
    case "vote":
      return (
        <Svg>
          <path d="M4 12.5h16v7H4zM8 12.5V9.5h8v3M9.5 5.5l2.5 4 3-5" />
        </Svg>
      );
    case "chevron":
      return (
        <Svg>
          <path d="M6 9l6 6 6-6" />
        </Svg>
      );
  }
}

const WEATHER_ICONS = new Set<string>(["clear", "rain", "fog", "thunderstorm", "scorcher", "snow"]);

/** A weather id's icon; unknown weather gets a plain cloud. */
export function weatherIcon(id: string): IconName {
  return WEATHER_ICONS.has(id) ? (id as IconName) : "weather";
}
