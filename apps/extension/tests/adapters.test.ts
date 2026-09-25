import { describe, expect, it } from "vitest";
import { getAdapter } from "../src/lib/adapters";
import { ashbyAdapter } from "../src/lib/adapters/ashby";
import { greenhouseAdapter } from "../src/lib/adapters/greenhouse";
import { leverAdapter } from "../src/lib/adapters/lever";
import { ashbyFields, greenhouseFields, leverFields } from "./captured-fields";
import { profile } from "./helpers";

describe("getAdapter", () => {
  it.each([
    ["boards.greenhouse.io", "Greenhouse"],
    ["job-boards.greenhouse.io", "Greenhouse"],
    ["jobs.lever.co", "Lever"],
    ["jobs.ashbyhq.com", "Ashby"],
  ])("%s -> %s", (host, name) => {
    expect(getAdapter(host)?.name).toBe(name);
  });

  it("returns undefined for other hosts", () => {
    expect(getAdapter("lever.co")).toBeUndefined(); // only the jobs.lever.co application host
    expect(getAdapter("careers.example.com")).toBeUndefined();
  });
});

describe("greenhouseAdapter", () => {
  it("targets stable ids only and splits the name", () => {
    expect(greenhouseAdapter.mapFields(greenhouseFields, profile)).toEqual([
      { selector: "sel-0", value: "Priya" },
      { selector: "sel-1", value: "Sharma" },
      { selector: "sel-2", value: "priya.sharma@example.com" },
      { selector: "sel-3", value: "+1 415 555 0192" },
      { selector: "sel-4", value: "San Francisco, CA" },
    ]);
  });

  it("skips fields the profile has no value for", () => {
    const result = greenhouseAdapter.mapFields(greenhouseFields, { ...profile, phone: undefined, location: undefined });
    expect(result.map((r) => r.selector)).toEqual(["sel-0", "sel-1", "sel-2"]);
  });
});

describe("leverAdapter", () => {
  it("targets name attributes including urls[...] links and current org", () => {
    const result = leverAdapter.mapFields(leverFields, profile);
    expect(result).toContainEqual({ selector: "sel-5", value: "Nimbus Analytics" });
    expect(result).toContainEqual({ selector: "sel-7", value: "https://github.com/priyasharma" });
    expect(result.find((r) => r.selector === "sel-0")).toBeUndefined(); // resume file
    expect(result.find((r) => r.selector === "sel-9")).toBeUndefined(); // custom card question
  });
});

describe("ashbyAdapter", () => {
  it("only fills the _systemfield_ name and email", () => {
    expect(ashbyAdapter.mapFields(ashbyFields, profile)).toEqual([
      { selector: "sel-1", value: "Priya Sharma" },
      { selector: "sel-4", value: "priya.sharma@example.com" },
    ]);
  });
});
