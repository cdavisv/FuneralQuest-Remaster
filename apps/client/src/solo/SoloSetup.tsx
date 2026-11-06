import type { Difficulty, SoloConfig } from "@fq/solo/client";
import { chooseRivals, practiceDay } from "@fq/solo/client";
import { type FormEvent, useId, useState } from "react";
import { useArt } from "../art/ArtContext.js";
import { useT } from "../i18n/I18nContext.js";
import type { MessageKey } from "../i18n/messages.js";
import { checkNames, type FieldName, type FormProblem } from "../net/errors.js";
import { ArrowRow, Field, FormAlert, useProblemText } from "../shell/forms.js";

export interface SoloSetupProps {
  /** Starts the game; a refusal's `field` (the engine's own complaint) shows under that field. */
  onStart: (config: SoloConfig) => Promise<void>;
  onBack: () => void;
  newSeed: () => number;
  busy: boolean;
}

/** A group of radio choices drawn as a row of chips. */
function Chips<T extends string | number>({
  legend,
  hint,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint?: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <fieldset className="fq-chips" aria-describedby={hint ? `${id}-d` : undefined}>
      <legend className="fq-field-label">{legend}</legend>
      <div className="fq-chips-row">
        {options.map((o) => (
          <label key={o.value} className="fq-chip" data-checked={o.value === value || undefined}>
            <input
              type="radio"
              name={`${id}-${name}`}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {hint && (
        <p id={`${id}-d`} className="fq-field-note">
          {hint}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The new-career form, in the style of the new-user screens: your name, your parlor, your sex
 * (the two skulls), then how many rivals and how good, how long and which wording.
 */
export function SoloSetup({ onStart, onBack, newSeed, busy }: SoloSetupProps) {
  const t = useT();
  const text = useProblemText();
  const art = useArt();
  const sexId = useId();
  const [name, setName] = useState("");
  const [parlor, setParlor] = useState("");
  const [male, setMale] = useState<boolean | null>(null);
  const [rivals, setRivals] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [ruleset, setRuleset] = useState<"classic" | "expanded">("classic");
  const [mode, setMode] = useState<"career" | "endless" | "daily">("career");
  const [wording, setWording] = useState<"classic" | "vintage">("classic");
  const [tour, setTour] = useState<"yes" | "no">("yes");
  const expanded = ruleset === "expanded";
  // The Daily Challenge practice is one seeded day with no rivals, Expanded only.
  const daily = expanded && mode === "daily";
  const [problem, setProblem] = useState<FormProblem | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const bad =
      checkNames(name, parlor) ??
      (male === null ? { field: "sex" as const, key: "form.err.sex" as MessageKey } : null);
    setProblem(bad);
    if (bad || male === null) return;
    const seed = newSeed();
    const config: SoloConfig = {
      seed,
      contentPack: expanded ? "expanded" : wording,
      ruleset,
      mode: expanded ? mode : mode === "daily" ? "career" : mode,
      ...(mode === "career" || (!expanded && mode === "daily") ? { careerDays: 30 } : {}),
      ...(expanded ? { tutorial: tour === "yes" && !daily } : {}),
      ...(daily ? { challengeDay: practiceDay(Date.now(), -new Date().getTimezoneOffset()) } : {}),
      clock: "manual",
      player: { name: name.trim(), parlor: parlor.trim(), male },
      rivals: daily ? [] : chooseRivals(rivals, difficulty, seed, ruleset),
    };
    try {
      await onStart(config);
    } catch (error) {
      const field = (error as { field?: string }).field;
      const known: FieldName = field === "name" || field === "parlor" ? field : null;
      const reason = error instanceof Error ? error.message : String(error);
      setProblem(
        known
          ? { field: known, text: reason }
          : { field: null, text: t("solo.setup.failed", { reason }) },
      );
    }
  };

  const skull = (isMale: boolean) => {
    const piece = art.piece(isMale ? "skull-male" : "skull-female");
    const label = isMale ? t("form.sex.male") : t("form.sex.female");
    const checked = male === isMale;
    return (
      <label className="fq-skull" data-checked={checked || undefined}>
        <input
          type="radio"
          name={sexId}
          checked={checked}
          onChange={() => setMale(isMale)}
          aria-label={label}
        />
        {piece ? (
          <img src={piece} alt="" draggable={false} />
        ) : (
          <span className="fq-skull-fallback" aria-hidden="true">
            {isMale ? "M" : "F"}
          </span>
        )}
        <span className="fq-skull-label">{label}</span>
      </label>
    );
  };

  return (
    <form
      className="fq-door-form fq-solo-setup"
      onSubmit={submit}
      noValidate
      aria-busy={busy || undefined}
    >
      <h2 className="fq-door-heading">{t("solo.setup.title")}</h2>
      <p className="fq-door-line">{t("solo.setup.lead")}</p>
      <div className="fq-solo-grid">
        <div className="fq-solo-col">
          <Field label={t("form.name")} error={text(problem, "name")}>
            {(p) => (
              <input
                {...p}
                type="text"
                value={name}
                maxLength={64}
                autoComplete="off"
                data-autofocus
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("form.parlor")} error={text(problem, "parlor")}>
            {(p) => (
              <input
                {...p}
                type="text"
                value={parlor}
                maxLength={64}
                autoComplete="off"
                onChange={(e) => setParlor(e.target.value)}
              />
            )}
          </Field>
          <fieldset className="fq-sex" aria-describedby={`${sexId}-d`}>
            <legend className="fq-field-label">{t("form.sex")}</legend>
            <div className="fq-sex-skulls">
              {skull(true)}
              {skull(false)}
            </div>
            <p id={`${sexId}-d`} className="fq-field-note">
              {text(problem, "sex") ? (
                <span className="fq-field-error" role="alert">
                  {text(problem, "sex")}
                </span>
              ) : (
                t("form.sex.hint")
              )}
            </p>
          </fieldset>
        </div>
        <div className="fq-solo-col">
          <Chips
            legend={t("x.lobby.ruleset")}
            hint={t(expanded ? "x.lobby.expanded.line" : "x.lobby.classic.line")}
            name="ruleset"
            value={ruleset}
            options={[
              { value: "classic", label: t("x.lobby.classic") },
              { value: "expanded", label: t("x.lobby.expanded") },
            ]}
            onChange={(v) => {
              setRuleset(v);
              if (v === "classic" && mode === "daily") setMode("career");
            }}
          />
          {!daily && (
            <Chips
              legend={t("solo.setup.rivals")}
              hint={t("solo.setup.rivals.hint")}
              name="rivals"
              value={rivals}
              options={[0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
              onChange={setRivals}
            />
          )}
          {!daily && (
            <Chips
              legend={t("solo.setup.difficulty")}
              name="difficulty"
              value={difficulty}
              options={[
                { value: "easy", label: t("solo.setup.difficulty.easy") },
                { value: "normal", label: t("solo.setup.difficulty.normal") },
                { value: "hard", label: t("solo.setup.difficulty.hard") },
              ]}
              onChange={setDifficulty}
            />
          )}
          <Chips
            legend={t("solo.setup.length")}
            hint={t(daily ? "solo.setup.length.dailyHint" : "solo.setup.length.hint")}
            name="mode"
            value={mode}
            options={[
              { value: "career", label: t("solo.setup.length.career") },
              { value: "endless", label: t("solo.setup.length.endless") },
              ...(expanded
                ? [{ value: "daily" as const, label: t("solo.setup.length.daily") }]
                : []),
            ]}
            onChange={setMode}
          />
          {expanded && !daily && (
            <Chips
              legend={t("solo.setup.tour")}
              hint={t("solo.setup.tour.hint")}
              name="tour"
              value={tour}
              options={[
                { value: "yes", label: t("solo.setup.tour.yes") },
                { value: "no", label: t("solo.setup.tour.no") },
              ]}
              onChange={setTour}
            />
          )}
          {!expanded && (
            <Chips
              legend={t("solo.setup.text")}
              hint={t("solo.setup.text.hint")}
              name="wording"
              value={wording}
              options={[
                { value: "classic", label: t("solo.setup.text.classic") },
                { value: "vintage", label: t("solo.setup.text.vintage") },
              ]}
              onChange={setWording}
            />
          )}
        </div>
      </div>
      <FormAlert problem={problem} />
      <ArrowRow
        onBack={onBack}
        backLabel={t("solo.setup.back")}
        continueLabel={t("solo.setup.start")}
        busy={busy}
      />
    </form>
  );
}
