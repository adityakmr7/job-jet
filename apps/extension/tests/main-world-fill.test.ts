/**
 * Runs the exact function main-world-fill.ts injects (mainWorldFill) against
 * fixture DOM: type-to-search comboboxes (bug 3), radio/checkbox option
 * matching (bug 8), Ashby Yes/No buttons, and <select> option matching.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mainWorldFill } from "../src/lib/main-world-fill";
import { collectFormFields } from "../src/lib/fields";
import { locationAliases } from "../src/lib/location";
import { allByQuestion, byLabel, mountPortal } from "./portal-helpers";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const aliases = locationAliases();

/** A react-select / Ashby-style async combobox: options only render after
 *  typing, once a (fake) geocoding lookup resolves. */
function asyncCombobox(results: string[]) {
  document.body.innerHTML = `
    <label for="loc">Location (City)</label>
    <div class="select"><input id="loc" role="combobox" aria-autocomplete="list" aria-expanded="false"></div>`;
  const input = document.getElementById("loc") as HTMLInputElement;
  const picked: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    document.getElementById("lb")?.remove();
    if (!input.value) return;
    timer = setTimeout(() => {
      const lb = document.createElement("div");
      lb.id = "lb";
      lb.setAttribute("role", "listbox");
      for (const r of results.filter((x) => x.toLowerCase().includes(input.value.toLowerCase()))) {
        const o = document.createElement("div");
        o.setAttribute("role", "option");
        o.textContent = r;
        o.addEventListener("click", () => {
          picked.push(r);
          input.value = "";
          lb.remove();
        });
        lb.appendChild(o);
      }
      document.body.appendChild(lb);
      input.setAttribute("aria-controls", "lb");
      input.setAttribute("aria-expanded", "true");
    }, 80);
  });
  return { input, picked };
}

describe("bug 3: type-to-search comboboxes", () => {
  it("types the city, waits for suggestions and picks the one matching 'San Francisco, CA'", async () => {
    const { picked } = asyncCombobox([
      "San Francisco, California, United States",
      "San Francisco de Macorís, Duarte, Dominican Republic",
      "San Francisco, Agusan del Sur, Philippines",
      "South San Francisco, California, United States",
    ]);
    const result = await mainWorldFill({ values: { "#loc": "San Francisco, CA" }, aliases, suggestionTimeoutMs: 2000 });
    expect(picked).toEqual(["San Francisco, California, United States"]);
    expect(result).toMatchObject({ filled: 1, total: 1 });
  });

  it("a city-only value ('Location (City)' → 'San Francisco') is disambiguated by the profile location", async () => {
    const { picked } = asyncCombobox([
      "San Francisco, California, United States",
      "San Francisco de Macorís, Duarte, Dominican Republic",
      "San Francisco, Agusan del Sur, Philippines",
      "San Francisco, Cebu, Philippines",
    ]);
    const result = await mainWorldFill({
      values: { "#loc": "San Francisco" },
      aliases,
      locationHint: "San Francisco, CA",
      suggestionTimeoutMs: 2500,
    });
    expect(picked).toEqual(["San Francisco, California, United States"]);
    expect(result).toMatchObject({ filled: 1, total: 1 });
  });

  it("leaves the field empty when no suggestion is an unambiguous match", async () => {
    const { input, picked } = asyncCombobox(["Springfield, Illinois, United States", "Springfield, Missouri, United States"]);
    const result = await mainWorldFill({ values: { "#loc": "Springfield" }, aliases, suggestionTimeoutMs: 800 });
    expect(picked).toEqual([]);
    expect(input.value).toBe("");
    expect(result.filled).toBe(0);
  });

  it("Lever-style location box: picks from .dropdown-results, keeps text when nothing matches", async () => {
    document.body.innerHTML = `
      <div class="application-field">
        <input class="location-input" id="location-input" name="location">
        <div class="dropdown-container"><div class="dropdown-results"></div></div>
      </div>`;
    const input = document.getElementById("location-input") as HTMLInputElement;
    const results = document.querySelector(".dropdown-results")!;
    let chosen = "";
    input.addEventListener("input", () => {
      results.innerHTML = "";
      setTimeout(() => {
        for (const text of ["San Francisco, CA, USA", "San Francisco, Petén, GTM"]) {
          const d = document.createElement("div");
          d.className = "dropdown-location";
          d.textContent = text;
          d.addEventListener("click", () => {
            chosen = text;
            input.value = text;
          });
          results.appendChild(d);
        }
      }, 50);
    });
    await mainWorldFill({ values: { "#location-input": "San Francisco, CA" }, aliases, suggestionTimeoutMs: 1500 });
    expect(chosen).toBe("San Francisco, CA, USA");
    expect(input.value).toBe("San Francisco, CA, USA");
  });

  it("static react-select options (Yes/No) are picked straight from the opened menu", async () => {
    document.body.innerHTML = `<input id="q" role="combobox">`;
    const input = document.getElementById("q")!;
    let chosen = "";
    input.addEventListener("mousedown", () => {
      if (document.getElementById("menu")) return;
      const lb = document.createElement("div");
      lb.id = "menu";
      lb.setAttribute("role", "listbox");
      for (const t of ["Yes", "No"]) {
        const o = document.createElement("div");
        o.setAttribute("role", "option");
        o.textContent = t;
        o.addEventListener("click", () => (chosen = t));
        lb.appendChild(o);
      }
      document.body.appendChild(lb);
      input.setAttribute("aria-controls", "menu");
    });
    const result = await mainWorldFill({ values: { "#q": "No" }, aliases });
    expect(chosen).toBe("No");
    expect(result.filled).toBe(1);
  });
});

describe("bug 8: radios/checkboxes — only the matching option is ticked", () => {
  it("Lever radios: 'Yes' sent to both options (old LLM/label behaviour) ticks only Yes", async () => {
    mountPortal("lever-eu-xtb");
    const fields = collectFormFields();
    const [yes, no] = allByQuestion(fields, /legally authorized to work in Poland/);
    const result = await mainWorldFill({ values: { [yes.selector]: "Yes", [no.selector]: "Yes" } });
    expect((document.querySelector(yes.selector) as HTMLInputElement).checked).toBe(true);
    expect((document.querySelector(no.selector) as HTMLInputElement).checked).toBe(false);
    expect(result.filled).toBe(1);
  });

  it("'No' sent to both options ticks only No", async () => {
    mountPortal("lever-eu-xtb");
    const fields = collectFormFields();
    const [yes, no] = allByQuestion(fields, /legally authorized to work in Poland/);
    await mainWorldFill({ values: { [yes.selector]: "No", [no.selector]: "No" } });
    expect((document.querySelector(yes.selector) as HTMLInputElement).checked).toBe(false);
    expect((document.querySelector(no.selector) as HTMLInputElement).checked).toBe(true);
  });

  it("Workable radios with value=true/false and YES/NO labels", async () => {
    mountPortal("workable-huggingface");
    const fields = collectFormFields();
    const [yes, no] = allByQuestion(fields, /eligible to work in the country/);
    await mainWorldFill({ values: { [yes.selector]: "Yes", [no.selector]: "Yes" } });
    expect((document.querySelector(yes.selector) as HTMLInputElement).checked).toBe(true);
    expect((document.querySelector(no.selector) as HTMLInputElement).checked).toBe(false);
  });

  it("a non-Yes/No radio is never ticked by a Yes answer", async () => {
    mountPortal("lever-eu-xtb");
    const fields = collectFormFields();
    const polish = allByQuestion(fields, /Polish language/);
    await mainWorldFill({ values: Object.fromEntries(polish.map((f) => [f.selector, "Yes"])) });
    expect(polish.some((f) => (document.querySelector(f.selector) as HTMLInputElement).checked)).toBe(false);
  });

  it("never unticks a checkbox the user already ticked", async () => {
    document.body.innerHTML = `<label><input type="checkbox" id="c" checked> Yes</label>`;
    await mainWorldFill({ values: { "#c": "No" } });
    expect((document.getElementById("c") as HTMLInputElement).checked).toBe(true);
  });
});

describe("Ashby Yes/No buttons", () => {
  it("clicks the button matching the answer", async () => {
    mountPortal("ashby-openai");
    const fields = collectFormFields();
    const auth = byLabel(fields, /authorized to work in the country/);
    const sponsor = byLabel(fields, /require sponsorship/);
    const clicks: string[] = [];
    document.querySelectorAll<HTMLButtonElement>("button[data-option]").forEach((b) =>
      b.addEventListener("click", () => {
        clicks.push(`${b.parentElement!.querySelector("input")!.getAttribute("name")!.slice(0, 4)}:${b.dataset.option}`);
        b.setAttribute("aria-pressed", "true");
      })
    );
    const result = await mainWorldFill({ values: { [auth.selector]: "Yes", [sponsor.selector]: "No" } });
    expect(clicks).toEqual(["bed9:yes", "bda7:no"]);
    expect(result.filled).toBe(2);
  });
});

describe("<select> option matching", () => {
  it("Yes/No answer against long option texts (Lever 'Visa permission')", async () => {
    mountPortal("lever-eu-xtb");
    const visa = byLabel(collectFormFields(), /^Visa permission$/);
    await mainWorldFill({ values: { [visa.selector]: "No" } });
    const el = document.querySelector(visa.selector) as HTMLSelectElement;
    expect(el.selectedOptions[0].textContent?.trim()).toMatch(/^No, I don't need a visa/);
  });

  it("'United States' picks 'United States +1', not the Minor Outlying Islands", async () => {
    document.body.innerHTML = `<select id="c"><option value="">Select...</option>
      <option value="um">United States Minor Outlying Islands +1</option><option value="us">United States +1</option></select>`;
    await mainWorldFill({ values: { "#c": "United States" } });
    expect((document.getElementById("c") as HTMLSelectElement).value).toBe("us");
  });

  it("an ambiguous partial answer selects nothing", async () => {
    document.body.innerHTML = `<select id="s"><option value="">Select...</option><option>Engineering Manager</option><option>Engineering Lead</option></select>`;
    const result = await mainWorldFill({ values: { "#s": "Engineering" } });
    expect((document.getElementById("s") as HTMLSelectElement).value).toBe("");
    expect(result.filled).toBe(0);
  });
});
