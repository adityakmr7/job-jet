import { describe, expect, it } from "vitest";
import { findLink, firstAndLastName, yesNo } from "../src/lib/profile-utils";
import { profile } from "./helpers";

describe("firstAndLastName", () => {
  it("splits on the first whitespace run", () => {
    expect(firstAndLastName("Priya Sharma")).toEqual({ first: "Priya", last: "Sharma" });
    expect(firstAndLastName("  Maria  de la   Cruz ")).toEqual({ first: "Maria", last: "de la Cruz" });
  });

  it("handles single names", () => {
    expect(firstAndLastName("Prince")).toEqual({ first: "Prince", last: "" });
  });
});

describe("findLink", () => {
  it("matches by label or URL, case-insensitively, first keyword hit wins", () => {
    expect(findLink(profile, "linkedin")).toBe("https://linkedin.com/in/priyasharma");
    expect(findLink(profile, "GITHUB".toLowerCase())).toBe("https://github.com/priyasharma");
    expect(findLink({ ...profile, links: [{ label: "Site", url: "https://github.com/x" }] }, "github")).toBe(
      "https://github.com/x"
    );
  });

  it("honours keyword priority over list order", () => {
    // GitHub is listed before Portfolio in the fixture profile.
    expect(findLink(profile, "portfolio", "website", "github")).toBe("https://priyasharma.dev");
    expect(findLink({ ...profile, links: profile.links.slice(0, 2) }, "portfolio", "website", "github")).toBe(
      "https://github.com/priyasharma"
    );
  });

  it("returns undefined when nothing matches", () => {
    expect(findLink(profile, "dribbble")).toBeUndefined();
  });
});

describe("yesNo", () => {
  it("maps booleans and preserves undefined", () => {
    expect(yesNo(true)).toBe("Yes");
    expect(yesNo(false)).toBe("No");
    expect(yesNo(undefined)).toBeUndefined();
  });
});
