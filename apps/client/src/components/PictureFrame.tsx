import type { CustomerPanel, View } from "@fq/protocol";
import type { ReactNode } from "react";
import { useT } from "../i18n/I18nContext.js";
import { PictureLayers } from "./Picture.js";

/**
 * Dark wood frame around the picture layers, with Class and Mood overlaid during a sale, and
 * `readout` (an Expanded customer's mood face and running total) in the opposite corner.
 */
export function PictureFrame({
  view,
  customer,
  readout,
}: {
  view: View;
  customer: CustomerPanel | undefined;
  readout?: ReactNode;
}) {
  const t = useT();
  return (
    <section className="fq-frame" aria-label={t("picture.label", { title: view.title })}>
      <div className="fq-frame-inner">
        <PictureLayers picture={view.picture} />
        {customer && (
          <p className="fq-overlay-tags" aria-hidden="true">
            <span>
              {t("customer.class")} {customer.incomeLabel}
            </span>
            <span>
              {t("customer.mood")} {customer.moodLabel}
            </span>
          </p>
        )}
        {readout}
      </div>
      {customer && (
        <p className="fq-sr">
          {t("customer.class")} {customer.incomeLabel}. {t("customer.mood")} {customer.moodLabel}.
        </p>
      )}
    </section>
  );
}
