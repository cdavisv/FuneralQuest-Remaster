import { useState } from "react";
import { useT } from "../i18n/I18nContext.js";
import { FeedbackDialog } from "./FeedbackDialog.js";
import { buildVersion, versionText } from "./version.js";

/** "Alpha 0.1.0 (build abc1234)": the build, as the front door and Settings show it. */
export function VersionText() {
  return <span data-testid="version-text">{versionText(buildVersion())}</span>;
}

/**
 * The front door's footer: the version and a "Send feedback" link that opens the report dialog.
 * (Settings has its own entry, in the same words.)
 */
export function VersionFooter() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <footer className="fq-version-footer">
      <VersionText />
      <button
        type="button"
        className="fq-linkbtn"
        data-testid="send-feedback"
        onClick={() => setOpen(true)}
      >
        {t("feedback.open")}
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </footer>
  );
}
