import { beforeEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.fn();
vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => generateObject(...args) }));
vi.mock("@/lib/ai", () => ({ getModel: () => "mock-model" }));

const { matchFieldsToProfilePaths } = await import("@/lib/field-mapping-llm");

// Braces matter: a function returned from beforeEach is run as teardown.
beforeEach(() => {
  generateObject.mockReset();
});

describe("matchFieldsToProfilePaths", () => {
  it("does not call the model for an empty field list", async () => {
    expect(await matchFieldsToProfilePaths([])).toEqual([]);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns exactly one result per input field, in input order", async () => {
    generateObject.mockResolvedValue({
      object: {
        matches: [
          { index: 2, profileFieldPath: "linkedin" },
          { index: 0, profileFieldPath: "email" },
          // index 1 skipped by the model
          { index: 99, profileFieldPath: "phone" }, // unknown index ignored
        ],
      },
    });
    const result = await matchFieldsToProfilePaths([
      { index: 0, label: "E-mail address", type: "text" },
      { index: 1, label: "Why do you want to work here?", type: "textarea" },
      { index: 2, label: "LinkedIn", type: "text" },
    ]);
    expect(result).toEqual([
      { index: 0, profileFieldPath: "email" },
      { index: 1, profileFieldPath: null },
      { index: 2, profileFieldPath: "linkedin" },
    ]);
  });

  it("sends only field descriptors and the allow-list to the model", async () => {
    generateObject.mockResolvedValue({ object: { matches: [] } });
    await matchFieldsToProfilePaths([{ index: 0, label: "Phone", type: "tel" }]);
    const call = generateObject.mock.calls[0][0];
    expect(call.model).toBe("mock-model");
    expect(call.system).toContain('"requiresSponsorship"');
    expect(call.prompt).toContain('"label": "Phone"');
  });

  it("propagates model errors to the caller (route treats the tier as best-effort)", async () => {
    generateObject.mockImplementation(async () => {
      throw new Error("quota");
    });
    await expect(matchFieldsToProfilePaths([{ index: 0, type: "text" }])).rejects.toThrow("quota");
  });
});
