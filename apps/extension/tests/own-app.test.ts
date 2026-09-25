import { describe, expect, it } from "vitest";
import { isOwnAppHost, ownAppHosts } from "../src/lib/own-app";

describe("ownAppHosts", () => {
  it("returns the production host plus its www variant", () => {
    expect(ownAppHosts("https://jobjet.example.com")).toEqual(["jobjet.example.com", "www.jobjet.example.com"]);
    expect(ownAppHosts("https://www.jobjet.example.com/")).toEqual(["www.jobjet.example.com", "jobjet.example.com"]);
  });

  it("treats localhost and 127.0.0.1 as the same dev server, keeping the port", () => {
    expect(ownAppHosts("http://localhost:3001")).toEqual(["localhost:3001", "127.0.0.1:3001"]);
  });

  it("returns nothing for missing or invalid URLs", () => {
    expect(ownAppHosts(undefined)).toEqual([]);
    expect(ownAppHosts("")).toEqual([]);
    expect(ownAppHosts("not a url")).toEqual([]);
  });
});

describe("isOwnAppHost", () => {
  it("matches host case-insensitively and respects ports", () => {
    expect(isOwnAppHost("JobJet.Example.com", "https://jobjet.example.com")).toBe(true);
    expect(isOwnAppHost("localhost:4000", "http://localhost:3001")).toBe(false);
    expect(isOwnAppHost("other.example.com", "https://jobjet.example.com")).toBe(false);
  });
});
