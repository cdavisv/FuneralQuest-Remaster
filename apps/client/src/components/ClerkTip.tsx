import type { RichText as Spans } from "@fq/protocol";
import { useArt } from "../art/ArtContext.js";
import { CLERK_ART } from "../expanded/clerk.js";
import { useT } from "../i18n/I18nContext.js";
import { assetUrl } from "../util/assets.js";
import { useAssetBase } from "./AssetContext.js";
import { RichText } from "./RichText.js";
import { useCover } from "./useCover.js";

/** The Guild clerk's portrait: the pack's `new-user-clerk` piece, else his exported picture. */
export function ClerkPortrait({ size }: { size?: number }) {
  const art = useArt().piece("new-user-clerk");
  const base = useAssetBase();
  const src = art ?? assetUrl(base, CLERK_ART);
  return (
    <span className="fq-clerk-face" style={size ? { width: size, height: size } : undefined}>
      {src && <img src={src} alt="" draggable={false} />}
    </span>
  );
}

/** A tutorial hint, said by the clerk who is watching: his portrait and a speech bubble. */
export function ClerkTip({ text, speaker }: { text: Spans; speaker: string }) {
  const t = useT();
  return (
    <aside className="fq-cliptip" aria-label={t("x.clerk.says")}>
      <ClerkPortrait />
      <p className="fq-cliptip-text">
        <b>{speaker}: </b>
        <RichText spans={text} />
      </p>
    </aside>
  );
}

/** The parchment on a tour page: whose tour it is and how far along. */
export function TourNote({ at, of, speaker }: { at: number; of: number; speaker: string }) {
  const t = useT();
  return (
    <section
      className="fq-npanel fq-tour fq-surface-light"
      data-cover={useCover()}
      aria-label={speaker}
    >
      <h2>{speaker}</h2>
      <p>{t("x.clerk.tour", { at, of })}</p>
      <div className="fq-tour-bar" role="img" aria-label={t("x.clerk.tour", { at, of })}>
        {Array.from({ length: of }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dots have no identity
          <i key={i} data-on={i < at ? "" : undefined} />
        ))}
      </div>
    </section>
  );
}
