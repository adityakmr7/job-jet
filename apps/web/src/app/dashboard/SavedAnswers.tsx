"use client";

import { Plus, X, MessagesSquare, Globe, EyeOff, ListPlus } from "lucide-react";
import {
  DECLINE_ANSWER,
  WORK_MODES,
  WORK_MODE_LABELS,
  type ApplicationAnswers,
  type CountryWorkAuth,
  type CustomAnswer,
  type DemographicKey,
  type WorkMode,
} from "@job-jet/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea, selectClasses } from "@/components/ui/field";

/**
 * Profile -> Saved answers: recurring application questions answered once
 * and reused by autofill (see packages/shared/src/answers.ts and the
 * extension's saved-answers.ts). Controlled by ProfileEditor, saved with
 * the rest of the profile.
 */

const addButton =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 h-8 text-sm font-semibold text-accent hover:bg-accent-soft transition-colors disabled:opacity-50";
const iconButton =
  "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-muted hover:text-danger hover:bg-danger-soft transition-colors";
const subCard = "rounded-[var(--radius-lg)] border border-border bg-surface-sunken/60 p-4 flex flex-col gap-3";

const REFERRAL_SUGGESTIONS = [
  "LinkedIn",
  "Company website",
  "Referral",
  "Job board",
  "Indeed",
  "Glassdoor",
  "Twitter / X",
  "Recruiter",
];
const NOTICE_SUGGESTIONS = ["Immediately", "1 week", "2 weeks", "1 month", "2 months", "3 months"];
const CURRENCY_SUGGESTIONS = ["USD", "EUR", "GBP", "INR", "CAD", "PLN", "AUD", "SGD"];
const COUNTRY_SUGGESTIONS = [
  "United States",
  "United Kingdom",
  "Canada",
  "India",
  "Germany",
  "Poland",
  "Netherlands",
  "Ireland",
  "Australia",
  "Singapore",
];

export const DEMOGRAPHIC_LABELS: Record<DemographicKey, string> = {
  gender: "Gender",
  raceEthnicity: "Race / ethnicity",
  hispanicLatino: "Hispanic or Latino",
  veteranStatus: "Veteran status",
  disabilityStatus: "Disability status",
  lgbtq: "LGBTQ+ community",
  transgender: "Transgender",
  sexualOrientation: "Sexual orientation",
};

function newId() {
  return crypto.randomUUID();
}

/** Drops empty rows and blank strings before saving so half-filled rows
 *  don't fail validation. */
export function cleanAnswers(a: ApplicationAnswers | undefined): ApplicationAnswers | undefined {
  if (!a) return undefined;
  const text = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
  const demographics = Object.fromEntries(
    Object.entries(a.demographics ?? {}).filter(([, v]) => typeof v === "string" && v.trim())
  ) as ApplicationAnswers["demographics"];
  return {
    referralSource: text(a.referralSource),
    noticePeriod: text(a.noticePeriod),
    earliestStartDate: text(a.earliestStartDate),
    salary:
      a.salary && a.salary.amount > 0 ? { ...a.salary, currency: a.salary.currency.trim().toUpperCase() } : undefined,
    willingToRelocate: a.willingToRelocate,
    workModes: a.workModes?.length ? a.workModes : undefined,
    yearsOfExperience: a.yearsOfExperience,
    workAuthorizationByCountry: a.workAuthorizationByCountry?.filter((c) => c.country.trim()),
    pronouns: text(a.pronouns),
    demographics,
    customAnswers: a.customAnswers?.filter((c) => c.question.trim() && c.answer.trim()),
  };
}

type YesNo = boolean | undefined;

function yesNoValue(v: YesNo): string {
  return v === undefined ? "" : v ? "yes" : "no";
}
function parseYesNo(v: string): YesNo {
  return v === "" ? undefined : v === "yes";
}

/** Not set / Yes / No as a small segmented control. */
function TriState({ value, onChange, label }: { value: YesNo; onChange: (v: YesNo) => void; label: string }) {
  const options: [string, string][] = [
    ["", "Not set"],
    ["yes", "Yes"],
    ["no", "No"],
  ];
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-full border border-border-strong bg-surface p-0.5"
    >
      {options.map(([v, text]) => {
        const checked = yesNoValue(value) === v;
        return (
          <button
            key={v || "unset"}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(parseYesNo(v))}
            className={`px-3 h-8 rounded-full text-sm font-medium transition-colors ${
              checked ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function SavedAnswersSection({
  value,
  onChange,
  fid,
}: {
  value: ApplicationAnswers;
  onChange: (next: ApplicationAnswers) => void;
  fid: (name: string) => string;
}) {
  const set = <K extends keyof ApplicationAnswers>(key: K, v: ApplicationAnswers[K]) =>
    onChange({ ...value, [key]: v });
  const modes = value.workModes ?? [];

  function toggleMode(mode: WorkMode, on: boolean) {
    set("workModes", on ? [...modes.filter((m) => m !== mode), mode] : modes.filter((m) => m !== mode));
  }

  return (
    <Card aria-labelledby={fid("answers")} id="saved-answers">
      <CardHeader
        id={fid("answers")}
        icon={<MessagesSquare className="w-4 h-4" aria-hidden />}
        title="Saved answers"
        description="The questions most application forms ask. Autofill uses these exactly as you write them; anything left blank stays blank."
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="How did you hear about us? (default answer)" htmlFor={fid("referral")} className="sm:col-span-2">
          <Input
            id={fid("referral")}
            list={fid("referral-list")}
            maxLength={200}
            placeholder="e.g. LinkedIn"
            value={value.referralSource ?? ""}
            onChange={(e) => set("referralSource", e.target.value)}
          />
          <datalist id={fid("referral-list")}>
            {REFERRAL_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <Field label="Notice period" htmlFor={fid("notice")} hint="e.g. Immediately, 2 weeks, 1 month">
          <Input
            id={fid("notice")}
            list={fid("notice-list")}
            maxLength={200}
            aria-describedby={`${fid("notice")}-hint`}
            value={value.noticePeriod ?? ""}
            onChange={(e) => set("noticePeriod", e.target.value)}
          />
          <datalist id={fid("notice-list")}>
            {NOTICE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <Field
          label="Earliest start date"
          htmlFor={fid("start")}
          hint="Optional. Once it's in the past, forms get today plus your notice period."
        >
          <Input
            id={fid("start")}
            type="date"
            aria-describedby={`${fid("start")}-hint`}
            value={value.earliestStartDate ?? ""}
            onChange={(e) => set("earliestStartDate", e.target.value || undefined)}
          />
        </Field>

        <fieldset className="sm:col-span-2 flex flex-col gap-1.5">
          <legend className="text-[13px] font-medium mb-1.5">Salary expectation (optional)</legend>
          <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
            <Input
              className="col-span-2 sm:col-span-1"
              aria-label="Salary amount"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Amount"
              value={value.salary?.amount ?? ""}
              onChange={(e) => {
                const amount = Number(e.target.value);
                set(
                  "salary",
                  e.target.value === "" || !(amount > 0)
                    ? undefined
                    : { currency: value.salary?.currency ?? "USD", period: value.salary?.period ?? "year", amount }
                );
              }}
            />
            <Input
              aria-label="Currency"
              list={fid("currency-list")}
              maxLength={3}
              placeholder="USD"
              disabled={!value.salary}
              value={value.salary?.currency ?? ""}
              onChange={(e) =>
                value.salary && set("salary", { ...value.salary, currency: e.target.value.toUpperCase() })
              }
            />
            <datalist id={fid("currency-list")}>
              {CURRENCY_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <select
              aria-label="Salary period"
              className={selectClasses}
              disabled={!value.salary}
              value={value.salary?.period ?? "year"}
              onChange={(e) =>
                value.salary && set("salary", { ...value.salary, period: e.target.value as "year" | "month" | "hour" })
              }
            >
              <option value="year">per year</option>
              <option value="month">per month</option>
              <option value="hour">per hour</option>
            </select>
          </div>
          <p className="text-xs text-muted">Converted between yearly and monthly when a form asks for the other.</p>
        </fieldset>

        <Field label="Years of experience" htmlFor={fid("years")} hint="Leave blank to count from your earliest role.">
          <Input
            id={fid("years")}
            type="number"
            min={0}
            max={70}
            aria-describedby={`${fid("years")}-hint`}
            value={value.yearsOfExperience ?? ""}
            onChange={(e) =>
              set(
                "yearsOfExperience",
                e.target.value === "" ? undefined : Math.min(70, Math.max(0, Number(e.target.value)))
              )
            }
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium" id={fid("relocate-label")}>
            Willing to relocate
          </span>
          <TriState
            label="Willing to relocate"
            value={value.willingToRelocate}
            onChange={(v) => set("willingToRelocate", v)}
          />
        </div>

        <fieldset className="sm:col-span-2 flex flex-col gap-1.5">
          <legend className="text-[13px] font-medium mb-1.5">Preferred work mode</legend>
          <div className="flex flex-wrap gap-2">
            {WORK_MODES.map((mode) => {
              const rank = modes.indexOf(mode);
              return (
                <label
                  key={mode}
                  className="flex items-center gap-2 rounded-full border border-border px-3.5 h-9 text-sm cursor-pointer hover:bg-surface-hover has-[:checked]:border-accent/40 has-[:checked]:bg-accent-soft/60 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-[var(--accent)]"
                    checked={rank >= 0}
                    onChange={(e) => toggleMode(mode, e.target.checked)}
                  />
                  {WORK_MODE_LABELS[mode]}
                  {rank >= 0 && modes.length > 1 && (
                    <span className="text-xs text-muted" aria-label={`preference ${rank + 1}`}>
                      #{rank + 1}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Tick the ones you&apos;d accept; the first one you tick counts as your top choice.
          </p>
        </fieldset>
      </div>
    </Card>
  );
}

export function CountryAuthList({
  value,
  onChange,
  fid,
}: {
  value: CountryWorkAuth[];
  onChange: (next: CountryWorkAuth[]) => void;
  fid: (name: string) => string;
}) {
  const update = (i: number, patch: Partial<CountryWorkAuth>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  return (
    <div className="flex flex-col gap-3 mt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Globe className="w-4 h-4 mt-0.5 text-muted" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold">By country</h3>
            <p className="text-xs text-muted mt-0.5">
              Used when a question names a country (&ldquo;…right to work in Canada?&rdquo;). Questions that don&apos;t
              name one use the answers above.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={addButton}
          onClick={() =>
            onChange([...value, { country: "", authorizedToWork: undefined, requiresSponsorship: undefined }])
          }
          disabled={value.length >= 30}
        >
          <Plus className="w-4 h-4" aria-hidden /> Add country
        </button>
      </div>
      <datalist id={fid("country-list")}>
        {COUNTRY_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {value.map((c, i) => (
        <div key={i} className={`${subCard} sm:flex-row sm:items-center`}>
          <Input
            aria-label={`Country ${i + 1}`}
            list={fid("country-list")}
            maxLength={60}
            placeholder="Country"
            className="sm:max-w-[14rem]"
            value={c.country}
            onChange={(e) => update(i, { country: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1">
            <span className="flex items-center gap-2 text-sm">
              <span className="text-muted">Authorized</span>
              <TriState
                label={`Authorized to work in ${c.country || `country ${i + 1}`}`}
                value={c.authorizedToWork}
                onChange={(v) => update(i, { authorizedToWork: v })}
              />
            </span>
            <span className="flex items-center gap-2 text-sm">
              <span className="text-muted">Needs sponsorship</span>
              <TriState
                label={`Needs sponsorship in ${c.country || `country ${i + 1}`}`}
                value={c.requiresSponsorship}
                onChange={(v) => update(i, { requiresSponsorship: v })}
              />
            </span>
          </div>
          <button
            type="button"
            className={iconButton}
            aria-label={`Remove ${c.country || `country ${i + 1}`}`}
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

function DemographicRow({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  id: string;
}) {
  const mode = !value ? "unset" : value === DECLINE_ANSWER ? "decline" : "answer";
  return (
    <div className="grid sm:grid-cols-[10rem_minmax(0,14rem)_minmax(0,1fr)] gap-2 sm:items-center">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <select
        id={id}
        className={selectClasses}
        value={mode}
        onChange={(e) =>
          onChange(e.target.value === "unset" ? undefined : e.target.value === "decline" ? DECLINE_ANSWER : " ")
        }
      >
        <option value="unset">Never fill (default)</option>
        <option value="decline">Decline to answer</option>
        <option value="answer">Answer with…</option>
      </select>
      {mode === "answer" ? (
        <Input
          aria-label={`${label} answer`}
          maxLength={100}
          placeholder="Your answer, as the form words it"
          value={value?.trimStart() ?? ""}
          onChange={(e) => onChange(e.target.value || " ")}
        />
      ) : (
        <span className="text-xs text-muted hidden sm:block">
          {mode === "decline" ? "Picks the form's “decline / prefer not to say” option." : "Left for you to answer."}
        </span>
      )}
    </div>
  );
}

export function VoluntaryAnswersSection({
  value,
  onChange,
  fid,
}: {
  value: ApplicationAnswers;
  onChange: (next: ApplicationAnswers) => void;
  fid: (name: string) => string;
}) {
  const demographics = value.demographics ?? {};
  return (
    <Card aria-labelledby={fid("voluntary")}>
      <CardHeader
        id={fid("voluntary")}
        icon={<EyeOff className="w-4 h-4" aria-hidden />}
        title="Voluntary questions"
        description="Pronouns and self-identification questions. Job Jet never fills these unless you choose an answer here."
      />
      <div className="flex flex-col gap-3">
        <Field label="Pronouns (optional)" htmlFor={fid("pronouns")} className="sm:max-w-sm">
          <Input
            id={fid("pronouns")}
            maxLength={40}
            placeholder="e.g. she/her"
            value={value.pronouns ?? ""}
            onChange={(e) => onChange({ ...value, pronouns: e.target.value })}
          />
        </Field>
        <div className="flex flex-col gap-2.5 mt-2">
          {(Object.keys(DEMOGRAPHIC_LABELS) as DemographicKey[]).map((key) => (
            <DemographicRow
              key={key}
              id={fid(`demo-${key}`)}
              label={DEMOGRAPHIC_LABELS[key]}
              value={demographics[key]}
              onChange={(v) => onChange({ ...value, demographics: { ...demographics, [key]: v } })}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

export function CustomAnswersSection({
  value,
  onChange,
  fid,
}: {
  value: CustomAnswer[];
  onChange: (next: CustomAnswer[]) => void;
  fid: (name: string) => string;
}) {
  const update = (i: number, patch: Partial<CustomAnswer>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  return (
    <Card aria-labelledby={fid("custom")}>
      <CardHeader
        id={fid("custom")}
        icon={<ListPlus className="w-4 h-4" aria-hidden />}
        title="Your own questions"
        description="Anything else you get asked a lot. A form question matches when it contains every key word of yours."
        action={
          <button
            type="button"
            className={addButton}
            disabled={value.length >= 50}
            onClick={() => onChange([...value, { id: newId(), question: "", answer: "" }])}
          >
            <Plus className="w-4 h-4" aria-hidden /> Add question
          </button>
        }
      />
      <div className="flex flex-col gap-3">
        {value.map((c, i) => (
          <div key={c.id} className={subCard}>
            <div className="flex items-start gap-2">
              <div className="flex-1 flex flex-col gap-2">
                <Field label="Question contains" htmlFor={fid(`cq-${i}`)}>
                  <Input
                    id={fid(`cq-${i}`)}
                    maxLength={200}
                    placeholder="e.g. open to contract roles"
                    value={c.question}
                    onChange={(e) => update(i, { question: e.target.value })}
                  />
                </Field>
                <Field label="Answer" htmlFor={fid(`ca-${i}`)}>
                  <Textarea
                    id={fid(`ca-${i}`)}
                    rows={2}
                    maxLength={2000}
                    value={c.answer}
                    onChange={(e) => update(i, { answer: e.target.value })}
                  />
                </Field>
              </div>
              <button
                type="button"
                className={`${iconButton} mt-6`}
                aria-label={`Remove question ${c.question || i + 1}`}
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
        {value.length === 0 && <p className="text-sm text-muted">No custom questions yet.</p>}
      </div>
    </Card>
  );
}
