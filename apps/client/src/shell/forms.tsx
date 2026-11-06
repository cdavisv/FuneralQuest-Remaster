import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import { useArt } from "../art/ArtContext.js";
import { useT } from "../i18n/I18nContext.js";
import type { MessageKey } from "../i18n/messages.js";
import {
  checkLogin,
  checkNames,
  checkPassword,
  describeError,
  type FieldName,
  type FormProblem,
} from "../net/errors.js";

/** One labelled field with its own error line, wired for screen readers. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: (props: {
    id: string;
    "aria-describedby": string;
    "aria-invalid": boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const describedBy = `${id}-d`;
  return (
    <div className="fq-field" data-invalid={error ? "true" : undefined}>
      <label htmlFor={id} className="fq-field-label">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      <p id={describedBy} className="fq-field-note">
        {error ? (
          <span className="fq-field-error" role="alert">
            {error}
          </span>
        ) : (
          hint
        )}
      </p>
    </div>
  );
}

/** Message text for a problem: the client's own words, or the server's when it gave clear ones. */
export function useProblemText(): (
  problem: FormProblem | null,
  field: FieldName,
) => string | undefined {
  const t = useT();
  return (problem, field) => {
    if (!problem || problem.field !== field) return undefined;
    return problem.key ? t(problem.key) : problem.text;
  };
}

/** A wooden plaque button (the same look as the game's choices). */
export function DoorButton({
  children,
  type = "button",
  onClick,
  disabled,
  autoFocus,
  variant,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  variant?: "quiet" | "primary";
}) {
  return (
    <button
      type={type}
      className="fq-dbtn fq-door-btn"
      data-variant={variant}
      aria-disabled={disabled || undefined}
      data-autofocus={autoFocus || undefined}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

/** Problems that belong to no field: shown above the buttons. */
export function FormAlert({ problem }: { problem: FormProblem | null }) {
  const t = useT();
  if (!problem || problem.field !== null) return null;
  return (
    <p className="fq-form-alert" role="alert">
      {problem.key ? t(problem.key) : problem.text}
    </p>
  );
}

export interface LogonFormProps {
  onLogIn: (login: string, password: string) => Promise<void>;
  onNewUser: () => void;
  onGuest: () => void;
  busy: boolean;
}

/** The original's plaque: "Please enter your name and password", LOGON, or click NEW USER. */
export function LogonForm({ onLogIn, onNewUser, onGuest, busy }: LogonFormProps) {
  const t = useT();
  const text = useProblemText();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const pwd = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const name = login.trim();
    if (name === "") {
      setProblem({ field: "login", key: "form.err.required" });
      return;
    }
    if (password === "") {
      setProblem({ field: "password", key: "form.err.required" });
      pwd.current?.focus();
      return;
    }
    setProblem(null);
    try {
      await onLogIn(name, password);
      setPassword("");
    } catch (error) {
      setProblem(describeError(error, "login"));
      setPassword("");
      pwd.current?.focus();
    }
  };

  return (
    <form className="fq-door-form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      <h2 className="fq-door-heading">{t("door.logon.title")}</h2>
      <Field label={t("form.login")} error={text(problem, "login")}>
        {(p) => (
          <input
            {...p}
            type="text"
            value={login}
            maxLength={64}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            data-autofocus
            onChange={(e) => setLogin(e.target.value)}
          />
        )}
      </Field>
      <Field label={t("form.password")} error={text(problem, "password")}>
        {(p) => (
          <input
            {...p}
            ref={pwd}
            type="password"
            value={password}
            maxLength={128}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <FormAlert problem={problem} />
      <div className="fq-door-actions">
        <DoorButton type="submit" disabled={busy} variant="primary">
          {t("door.logon.go")}
        </DoorButton>
        <span className="fq-door-or">{t("door.or")}</span>
        <DoorButton onClick={onNewUser} disabled={busy}>
          {t("door.newUser")}
        </DoorButton>
      </div>
      <p className="fq-door-guest">
        <button type="button" className="fq-linkbtn" onClick={onGuest} disabled={busy}>
          {t("door.guest")}
        </button>
        <span className="fq-field-note">{t("door.guest.note")}</span>
      </p>
    </form>
  );
}

/** Back and continue arrows, as at the foot of the original's new-user screens. */
export function ArrowRow({
  onBack,
  backLabel,
  continueLabel,
  busy,
}: {
  onBack: () => void;
  backLabel: string;
  continueLabel: string;
  busy: boolean;
}) {
  const arrow = useArt().piece("button-arrow-next");
  const icon = arrow ? (
    <img src={arrow} alt="" draggable={false} />
  ) : (
    <span aria-hidden="true">&#9654;</span>
  );
  return (
    <div className="fq-arrows">
      <button type="button" className="fq-arrow fq-arrow-back" onClick={onBack} disabled={busy}>
        {icon}
        <span>{backLabel}</span>
      </button>
      <button type="submit" className="fq-arrow fq-arrow-next" aria-disabled={busy || undefined}>
        <span>{continueLabel}</span>
        {icon}
      </button>
    </div>
  );
}

/** New user, first form: the log-on name and password. */
export function CredentialsForm({
  onSubmit,
  onBack,
  busy,
}: {
  onSubmit: (login: string, password: string) => Promise<void>;
  onBack: () => void;
  busy: boolean;
}) {
  const t = useT();
  const text = useProblemText();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const name = login.trim();
    const bad = checkLogin(name) ?? checkPassword(password);
    setProblem(bad);
    if (bad) return;
    try {
      await onSubmit(name, password);
    } catch (error) {
      setProblem(describeError(error, "signup"));
    }
  };

  return (
    <form className="fq-door-form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      <h2 className="fq-door-heading">{t("newuser.account.title")}</h2>
      <Field label={t("form.login")} hint={t("form.login.hint")} error={text(problem, "login")}>
        {(p) => (
          <input
            {...p}
            type="text"
            value={login}
            maxLength={20}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            data-autofocus
            onChange={(e) => setLogin(e.target.value)}
          />
        )}
      </Field>
      <Field
        label={t("form.password")}
        hint={t("form.password.hint")}
        error={text(problem, "password")}
      >
        {(p) => (
          <input
            {...p}
            type={show ? "text" : "password"}
            value={password}
            maxLength={128}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <label className="fq-check">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        {t("form.password.show")}
      </label>
      <FormAlert problem={problem} />
      <ArrowRow
        onBack={onBack}
        backLabel={t("newuser.back")}
        continueLabel={t("newuser.continue")}
        busy={busy}
      />
    </form>
  );
}

/** "What's your sex?": the two skulls, a radio group. */
export function SexPicker({
  male,
  onChange,
  error,
}: {
  male: boolean | null;
  onChange: (male: boolean) => void;
  error?: string | undefined;
}) {
  const t = useT();
  const art = useArt();
  const sexId = useId();
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
          onChange={() => onChange(isMale)}
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
    <fieldset className="fq-sex" aria-describedby={`${sexId}-d`}>
      <legend className="fq-field-label">{t("form.sex")}</legend>
      <div className="fq-sex-skulls">
        {skull(true)}
        {skull(false)}
      </div>
      <p id={`${sexId}-d`} className="fq-field-note">
        {error ? (
          <span className="fq-field-error" role="alert">
            {error}
          </span>
        ) : (
          t("form.sex.hint")
        )}
      </p>
    </fieldset>
  );
}

/** New user, second form: your name, your parlor, your sex (two skulls). */
export function ParlorForm({
  onSubmit,
  onBack,
  busy,
}: {
  onSubmit: (form: { name: string; parlor: string; male: boolean }) => Promise<void>;
  onBack: () => void;
  busy: boolean;
}) {
  const t = useT();
  const text = useProblemText();
  const [name, setName] = useState("");
  const [parlor, setParlor] = useState("");
  const [male, setMale] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const shown = problem;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const bad =
      checkNames(name, parlor) ??
      (male === null ? { field: "sex" as const, key: "form.err.sex" as MessageKey } : null);
    setProblem(bad);
    if (bad || male === null) return;
    try {
      await onSubmit({ name: name.trim(), parlor: parlor.trim(), male });
    } catch (error) {
      setProblem(describeError(error, "enter"));
    }
  };

  return (
    <form className="fq-door-form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      <h2 className="fq-door-heading">{t("newuser.parlor.title")}</h2>
      <Field label={t("form.name")} hint={t("form.name.hint")} error={text(shown, "name")}>
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
      <Field label={t("form.parlor")} hint={t("form.parlor.hint")} error={text(shown, "parlor")}>
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
      <SexPicker male={male} onChange={setMale} error={text(shown, "sex")} />
      <FormAlert problem={shown} />
      <ArrowRow
        onBack={onBack}
        backLabel={t("newuser.back")}
        continueLabel={t("newuser.open")}
        busy={busy}
      />
    </form>
  );
}

/** Someone is already signed in on this device: carry on or sign out. */
export function WelcomeBack({
  login,
  guest,
  parlorName,
  onContinue,
  onLogOut,
  busy,
}: {
  login: string;
  guest: boolean;
  parlorName: string | null;
  onContinue: () => void;
  onLogOut: () => void;
  busy: boolean;
}) {
  const t = useT();
  return (
    <div className="fq-door-form">
      <h2 className="fq-door-heading">{t("door.welcomeBack", { name: parlorName ?? login })}</h2>
      <p className="fq-door-line">
        {parlorName ? t("door.welcomeBack.parlor") : t("door.welcomeBack.new")}
      </p>
      {guest && <p className="fq-field-note">{t("door.guest.warning")}</p>}
      <div className="fq-door-actions">
        <DoorButton onClick={onContinue} disabled={busy} autoFocus variant="primary">
          {parlorName ? t("door.continue") : t("door.start")}
        </DoorButton>
        <DoorButton onClick={onLogOut} disabled={busy} variant="quiet">
          {t("door.logout")}
        </DoorButton>
      </div>
    </div>
  );
}
