import { PACK_IDS as SOUND_PACK_IDS, type PackId as SoundPackId } from "@fq/audio";
import { useId } from "react";
import { useArt } from "../art/ArtContext.js";
import { PACKS } from "../art/packs.js";
import { useCurrentMusic } from "../audio/AudioContext.js";
import { useT } from "../i18n/I18nContext.js";
import type { MessageKey } from "../i18n/messages.js";
import { SafetySettings } from "../moderation/SafetySettings.js"; // moderation hook
import {
  type FontSize,
  type LayoutChoice,
  prefersReducedMotion,
  type TypewriterSpeed,
  useSettings,
} from "../settings/settings.js";
import { getWrapper, openWrapperSettings } from "../wrapper.js";
import { Dialog } from "./Dialog.js";

function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="fq-set-group">
      <legend>{legend}</legend>
      <div className="fq-set-choices">
        {options.map((o) => (
          <label key={o.value} className="fq-set-choice">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="fq-set-slider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)}%`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <output htmlFor={id}>{Math.round(value * 100)}%</output>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="fq-set-choice fq-set-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const id = useId();
  const { settings, update } = useSettings();
  const music = useCurrentMusic();
  const art = useArt();
  const opts = <T extends string>(prefix: string, values: T[]) =>
    values.map((value) => ({ value, label: t(`${prefix}.${value}` as MessageKey) }));
  return (
    <Dialog className="fq-dialog fq-settings fq-surface-dark" labelledBy={id}>
      <h2 id={id} className="fq-settings-title">
        {t("settings.title")}
      </h2>
      <h3 className="fq-set-heading">{t("settings.display")}</h3>
      <Choice<FontSize>
        legend={t("settings.fontSize")}
        name="fq-font-size"
        value={settings.fontSize}
        options={opts("settings.fontSize", ["small", "normal", "large", "xlarge"])}
        onChange={(fontSize) => update({ fontSize })}
      />
      <Choice<TypewriterSpeed>
        legend={t("settings.typewriter")}
        name="fq-typewriter"
        value={settings.typewriter}
        options={opts("settings.typewriter", ["off", "fast", "normal"])}
        onChange={(typewriter) => update({ typewriter })}
      />
      <Choice<LayoutChoice>
        legend={t("settings.layout")}
        name="fq-layout"
        value={settings.layout}
        options={opts("settings.layout", ["auto", "classic", "wide", "phone"])}
        onChange={(layout) => update({ layout })}
      />
      <Choice<string>
        legend={t("settings.artPack")}
        name="fq-art-pack"
        value={art.pack.id}
        options={PACKS.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(artPack) => update({ artPack })}
      />
      {art.pack.description && <p className="fq-set-note">{art.pack.description}</p>}
      {prefersReducedMotion() && <p className="fq-set-note">{t("settings.reducedMotion")}</p>}
      <h3 className="fq-set-heading">{t("settings.audio")}</h3>
      <Slider
        label={t("settings.volume.master")}
        value={settings.volume.master}
        onChange={(master) => update({ volume: { master } })}
      />
      <Slider
        label={t("settings.volume.music")}
        value={settings.volume.music}
        onChange={(m) => update({ volume: { music: m } })}
      />
      <Slider
        label={t("settings.volume.ambience")}
        value={settings.volume.ambience}
        onChange={(ambience) => update({ volume: { ambience } })}
      />
      <Slider
        label={t("settings.volume.effects")}
        value={settings.volume.effects}
        onChange={(effects) => update({ volume: { effects } })}
      />
      <Toggle
        label={t("settings.audio.mute")}
        checked={settings.muted}
        onChange={(muted) => update({ muted })}
      />
      <Toggle
        label={t("settings.audio.radio")}
        checked={settings.radio}
        onChange={(radio) => update({ radio })}
      />
      <Choice<SoundPackId>
        legend={t("settings.audio.pack")}
        name="fq-sound-pack"
        value={settings.soundPack}
        options={opts("settings.audio.pack", [...SOUND_PACK_IDS])}
        onChange={(soundPack) => update({ soundPack })}
      />
      <p className="fq-set-note">{t("settings.audio.pack.note")}</p>
      <p className="fq-set-note" data-testid="sound-pack-note">
        {t(`settings.audio.note.${settings.soundPack}`)}
      </p>
      <p className="fq-set-note">
        {music ? t("settings.audio.nowPlaying", { id: music }) : t("settings.audio.none")}
      </p>
      {getWrapper()?.openSettings && (
        <>
          <h3 className="fq-set-heading">{t("settings.server")}</h3>
          <p className="fq-set-note">{t("settings.server.note")}</p>
          <p>
            <button
              type="button"
              className="fq-dbtn"
              data-testid="server-address"
              onClick={() => {
                // The wrapper's own dialog opens above this one; it reloads the page if the address changes.
                openWrapperSettings();
              }}
            >
              {t("settings.server.open")}
            </button>
          </p>
        </>
      )}
      {/* moderation hook: renders only in an online session */}
      <SafetySettings />
      <h3 className="fq-set-heading">{t("settings.help")}</h3>
      <p className="fq-set-note">
        {(["intro", "gameplay", "rules", "credits"] as const).map((page, i) => (
          <span key={page}>
            {i > 0 && " | "}
            <a href={`/#/${page}`} target="_blank" rel="noopener noreferrer" className="fq-linkbtn">
              {t(`page.${page}`)}
            </a>
          </span>
        ))}
      </p>
      <div className="fq-dialog-actions">
        <button type="button" className="fq-dbtn" onClick={onClose}>
          {t("settings.close")}
        </button>
      </div>
    </Dialog>
  );
}
