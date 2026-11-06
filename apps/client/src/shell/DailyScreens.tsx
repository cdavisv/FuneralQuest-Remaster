import type { BoardRow } from "@fq/protocol";
import type { DailyChallengeScore, LeaderboardRow } from "@fq/server/client";
import { type FormEvent, useEffect, useState } from "react";
import { BoardTable } from "../components/BoardTable.js";
import { useT } from "../i18n/I18nContext.js";
import type {
  DailyApi,
  DailyChallengeInfo,
  LeaderboardResponse,
  ParlorForm,
} from "../net/backend.js";
import { checkNames, type FormProblem } from "../net/errors.js";
import { ArrowRow, DoorButton, Field, FormAlert, SexPicker, useProblemText } from "./forms.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => `$${nf.format(n)}`;

/** The board's rows as the table draws them (`View.board`'s shape), the viewer's row marked. */
export function leaderboardRows(
  rows: LeaderboardRow[],
  you: LeaderboardRow | null,
  detail: (r: LeaderboardRow) => string,
): BoardRow[] {
  const out = rows.map<BoardRow>((r) => ({
    place: r.place,
    name: r.name,
    detail: detail(r),
    score: r.score,
    ...(you && you.place === r.place && you.name === r.name ? { mine: true } : {}),
  }));
  // The viewer's own row is sent even beyond the limit: show it after the others.
  if (you && !out.some((r) => r.mine)) {
    out.push({
      place: you.place,
      name: you.name,
      detail: detail(you),
      score: you.score,
      mine: true,
    });
  }
  return out;
}

function Result({ result, place }: { result: DailyChallengeScore; place: number | null }) {
  const t = useT();
  return (
    <section className="fq-daily-result" aria-label={t("x.challenge.yours")}>
      <h3>{t("x.challenge.yours")}</h3>
      <dl>
        <div data-key="score">
          <dt>{t("x.challenge.score")}</dt>
          <dd>{nf.format(result.score)}</dd>
        </div>
        <div>
          <dt>{t("x.challenge.money")}</dt>
          <dd>{dollars(result.money)}</dd>
        </div>
        <div>
          <dt>{t("x.challenge.sales")}</dt>
          <dd>{result.sales}</dd>
        </div>
        <div>
          <dt>{t("x.challenge.exact")}</dt>
          <dd>{result.exact}</dd>
        </div>
        <div>
          <dt>{t("x.challenge.walkouts")}</dt>
          <dd>{result.walkouts}</dd>
        </div>
      </dl>
      {place !== null && (
        <p className="fq-daily-place">{t("x.challenge.place.you", { n: place })}</p>
      )}
      {result.abandoned && <p className="fq-field-note">{t("x.challenge.abandoned")}</p>}
    </section>
  );
}

type Loaded<T> = { state: "loading" } | { state: "error" } | { state: "ready"; value: T };

function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ state: "loading" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the loader's inputs.
  useEffect(() => {
    let cancelled = false;
    setState({ state: "loading" });
    load().then(
      (value) => !cancelled && setState({ state: "ready", value }),
      () => !cancelled && setState({ state: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);
  return state;
}

const NAME_KEY = "fq.daily.name.v1";

/** The name and parlor this player last chose for the board (their own choice, never the log-on name). */
export function rememberedBoardName(): { name: string; parlor: string; male: boolean | null } {
  try {
    const raw = JSON.parse(localStorage.getItem(NAME_KEY) ?? "null") as {
      name?: unknown;
      parlor?: unknown;
      male?: unknown;
    } | null;
    if (raw && typeof raw.name === "string" && typeof raw.parlor === "string") {
      return {
        name: raw.name,
        parlor: raw.parlor,
        male: typeof raw.male === "boolean" ? raw.male : null,
      };
    }
  } catch {
    // Unreadable or blocked storage: start empty.
  }
  return { name: "", parlor: "", male: null };
}

function rememberBoardName(form: ParlorForm): void {
  try {
    localStorage.setItem(
      NAME_KEY,
      JSON.stringify({ name: form.name, parlor: form.parlor, male: form.male }),
    );
  } catch {
    // Storage blocked: the form is simply empty next time.
  }
}

/**
 * What the public board will call the player. The board is public, so nothing is filled in from the
 * account: the log-on name goes in only if the player says so and confirms that it will be published.
 */
export function DailyNameForm({
  login,
  guest,
  busy,
  onSubmit,
  onBack,
  onResults,
}: {
  login: string | null;
  guest: boolean;
  busy: boolean;
  onSubmit: (form: ParlorForm) => void;
  onBack: () => void;
  onResults: () => void;
}) {
  const t = useT();
  const text = useProblemText();
  const start = rememberedBoardName();
  const [name, setName] = useState(start.name);
  const [parlor, setParlor] = useState(start.parlor);
  const [male, setMale] = useState<boolean | null>(start.male);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [asking, setAsking] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const bad =
      checkNames(name, parlor) ??
      (male === null ? { field: "sex" as const, key: "form.err.sex" as const } : null);
    setProblem(bad);
    if (bad || male === null) return;
    const form = { name: name.trim(), parlor: parlor.trim(), male };
    if (!guest) rememberBoardName(form);
    onSubmit(form);
  };

  return (
    <form className="fq-door-form fq-daily-name" onSubmit={submit} noValidate>
      <h3 className="fq-door-heading">{t("x.challenge.nameTitle")}</h3>
      <p className="fq-field-note">
        {guest ? t("x.challenge.nameGuest") : t("x.challenge.namePublic")}
      </p>
      <Field label={t("form.name")} hint={t("form.name.hint")} error={text(problem, "name")}>
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
      <Field label={t("form.parlor")} hint={t("form.parlor.hint")} error={text(problem, "parlor")}>
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
      <SexPicker male={male} onChange={setMale} error={text(problem, "sex")} />
      {!guest && login && !asking && (
        <button type="button" className="fq-linkbtn" onClick={() => setAsking(true)}>
          {t("x.challenge.useLogin")}
        </button>
      )}
      {asking && login && (
        <fieldset className="fq-daily-confirm">
          <legend className="fq-sr">{t("x.challenge.useLogin")}</legend>
          <p className="fq-field-note">{t("x.challenge.useLogin.ask", { login })}</p>
          <div className="fq-door-actions">
            <DoorButton
              onClick={() => {
                setName(login);
                setAsking(false);
              }}
            >
              {t("x.challenge.useLogin.yes")}
            </DoorButton>
            <DoorButton variant="quiet" onClick={() => setAsking(false)}>
              {t("x.challenge.useLogin.no")}
            </DoorButton>
          </div>
        </fieldset>
      )}
      <FormAlert problem={problem} />
      <ArrowRow
        onBack={onBack}
        backLabel={t("x.challenge.back")}
        continueLabel={t("x.challenge.start")}
        busy={busy}
      />
      <p className="fq-field-note">
        <button type="button" className="fq-linkbtn" onClick={onResults}>
          {t("x.challenge.results")}
        </button>
      </p>
    </form>
  );
}

/**
 * The Daily Challenge's own plaque: what today is, whether this account has played it, and the
 * way in. Guests may play; they get a result but no place on the board.
 */
export function DailyDoor({
  daily,
  signedIn,
  login,
  busy,
  problem,
  onPlay,
  onGuest,
  onResults,
  onBack,
}: {
  daily: DailyApi;
  signedIn: boolean;
  /** The account's log-on name, offered (with confirmation) as the board name. */
  login?: string | null;
  busy: boolean;
  problem: string | null;
  /** Start or resume; `parlor` is the board name the player chose (absent when resuming). */
  onPlay: (parlor?: ParlorForm) => void;
  onGuest: () => void;
  onResults: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const info = useLoaded<DailyChallengeInfo>(() => daily.info(), `${signedIn}`);
  const you = info.state === "ready" ? info.value.you : null;
  const done = you?.status === "finished";
  // A run not yet begun asks what the public board should call the player first.
  const naming = signedIn && info.state === "ready" && !done && you?.status !== "playing";
  return (
    <div className="fq-door-form fq-daily">
      <h2 className="fq-door-heading">{t("x.challenge.title")}</h2>
      <p className="fq-door-line">{t("x.challenge.line")}</p>
      {info.state === "loading" && (
        <p role="status" className="fq-field-note">
          {t("x.challenge.loading")}
        </p>
      )}
      {info.state === "error" && (
        <p role="alert" className="fq-field-error">
          {t("x.challenge.error")}
        </p>
      )}
      {info.state === "ready" && (
        <>
          <p className="fq-daily-day">{t("x.challenge.when", { id: info.value.day })}</p>
          <p className="fq-field-note">
            {t("x.challenge.loadout", {
              turns: info.value.loadout.turns,
              money: dollars(info.value.loadout.money),
              psych: info.value.loadout.psych,
            })}{" "}
            {t("x.challenge.counts", { played: info.value.played, ranked: info.value.ranked })}
          </p>
          {you && (
            <p className="fq-daily-status" data-status={you.status}>
              {t(`x.challenge.status.${you.status}` as "x.challenge.status.available")}
            </p>
          )}
          {you?.result && <Result result={you.result} place={you.place} />}
          {you?.result && you.guest && (
            <p className="fq-field-note">{t("x.challenge.guestResult")}</p>
          )}
        </>
      )}
      {problem && (
        <p role="alert" className="fq-field-error">
          {problem}
        </p>
      )}
      {!signedIn && <p className="fq-field-note">{t("x.challenge.needAccount")}</p>}
      {naming && you ? (
        <DailyNameForm
          login={login ?? null}
          guest={you.guest}
          busy={busy}
          onSubmit={(form) => onPlay(form)}
          onBack={onBack}
          onResults={onResults}
        />
      ) : (
        <div className="fq-door-actions">
          {signedIn ? (
            done ? (
              <DoorButton onClick={onResults} disabled={busy} autoFocus variant="primary">
                {t("x.challenge.viewResults")}
              </DoorButton>
            ) : (
              <DoorButton
                onClick={() => onPlay()}
                disabled={busy || info.state !== "ready"}
                autoFocus
                variant="primary"
              >
                {you?.status === "playing" ? t("x.challenge.resume") : t("x.challenge.play")}
              </DoorButton>
            )
          ) : (
            <DoorButton onClick={onGuest} disabled={busy} autoFocus variant="primary">
              {t("x.challenge.guest")}
            </DoorButton>
          )}
          {!done && (
            <DoorButton onClick={onResults} disabled={busy} variant="quiet">
              {t("x.challenge.results")}
            </DoorButton>
          )}
          <DoorButton onClick={onBack} disabled={busy} variant="quiet">
            {t("x.challenge.back")}
          </DoorButton>
        </div>
      )}
    </div>
  );
}

/**
 * The results: this account's result for today, and the board of any day that has one (newest
 * first, today by default).
 */
export function DailyResults({ daily, onBack }: { daily: DailyApi; onBack: () => void }) {
  const t = useT();
  const [day, setDay] = useState<string | undefined>(undefined);
  const board = useLoaded<LeaderboardResponse>(() => daily.leaderboard(day), `board:${day ?? ""}`);
  const info = useLoaded<DailyChallengeInfo>(() => daily.info(), "info");
  const days = useLoaded<{ day: string; entries: number }[]>(() => daily.days(), "days");
  const you = info.state === "ready" ? info.value.you : null;
  const today = info.state === "ready" ? info.value.day : undefined;
  const shown = board.state === "ready" ? board.value.day : (day ?? today);
  // Today may not have a board yet: it is still the first choice, ahead of the days that do.
  const choices = (() => {
    const list = days.state === "ready" ? days.value : [];
    const out = list.map((d) => ({ day: d.day, entries: d.entries }));
    if (today && !out.some((d) => d.day === today)) out.unshift({ day: today, entries: 0 });
    return out;
  })();
  return (
    <div className="fq-door-form fq-daily">
      <h2 className="fq-door-heading">{t("x.challenge.results")}</h2>
      {you?.result && (!day || day === today) && <Result result={you.result} place={you.place} />}
      {you?.result && you.guest && (!day || day === today) && (
        <p className="fq-field-note">{t("x.challenge.guestResult")}</p>
      )}
      {choices.length > 1 && (
        <Field label={t("x.challenge.pickDay")}>
          {(p) => (
            <select
              {...p}
              value={shown ?? ""}
              data-testid="daily-day"
              onChange={(e) => setDay(e.target.value === today ? undefined : e.target.value)}
            >
              {choices.map((d) => (
                <option key={d.day} value={d.day}>
                  {d.day === today
                    ? t("x.challenge.dayToday", { day: d.day })
                    : t("x.challenge.dayRow", { day: d.day, count: d.entries })}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {board.state === "loading" && (
        <p role="status" className="fq-field-note">
          {t("x.challenge.loading")}
        </p>
      )}
      {board.state === "error" && (
        <p role="alert" className="fq-field-error">
          {t("x.challenge.error")}
        </p>
      )}
      {board.state === "ready" &&
        (board.value.entries.length === 0 ? (
          <p className="fq-field-note">{t("x.challenge.empty")}</p>
        ) : (
          <div className="fq-daily-board">
            <BoardTable
              plain
              title={`${t("x.challenge.board")}, ${board.value.day}`}
              rows={leaderboardRows(board.value.entries, board.value.you, (r) =>
                t("x.challenge.rowDetail", { parlor: r.parlor, sales: r.sales }),
              )}
            />
            <p className="fq-field-note">{t("x.challenge.total", { count: board.value.total })}</p>
          </div>
        ))}
      <div className="fq-door-actions">
        <DoorButton onClick={onBack} autoFocus variant="primary">
          {t("x.challenge.back")}
        </DoorButton>
      </div>
    </div>
  );
}
