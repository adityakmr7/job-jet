import { describe, expect, it, vi } from "vitest";
import { actionEmail, ConsoleEmailSender, createEmailSender, redactEmail, ResendEmailSender } from "@/lib/email";

describe("createEmailSender", () => {
  it("uses Resend when RESEND_API_KEY is set, console otherwise", () => {
    expect(createEmailSender({ RESEND_API_KEY: "re_123" }).name).toBe("resend");
    expect(createEmailSender({}).name).toBe("console");
  });
});

describe("ConsoleEmailSender", () => {
  const msg = actionEmail({ to: "ada@example.com", subject: "Reset", heading: "H", body: "B", actionLabel: "Go", url: "https://x/reset?token=secret" });

  it("prints the link in development", async () => {
    const log = vi.fn();
    await new ConsoleEmailSender(false, log).send(msg);
    expect(log.mock.calls[0][0]).toContain("token=secret");
  });

  it("never logs the link (a credential) in production", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.fn();
    await new ConsoleEmailSender(true, log).send(msg);
    expect(log).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).not.toContain("secret");
    expect(warn.mock.calls.flat().join(" ")).toContain("a***@example.com");
    warn.mockRestore();
  });
});

describe("ResendEmailSender", () => {
  it("posts to the Resend API and surfaces failures", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await new ResendEmailSender("re_key", "Job Jet <a@b.c>", fetchImpl as unknown as typeof fetch).send({ to: "x@y.z", subject: "S", text: "T" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(init.body as string)).toMatchObject({ from: "Job Jet <a@b.c>", to: ["x@y.z"] });

    const failing = vi.fn(async () => new Response("bad", { status: 422 }));
    await expect(new ResendEmailSender("k", "f", failing as unknown as typeof fetch).send({ to: "x", subject: "s", text: "t" })).rejects.toThrow(/422/);
  });
});

describe("actionEmail", () => {
  it("escapes HTML in the template", () => {
    const { html } = actionEmail({ to: "a", subject: "s", heading: "<b>hi</b>", body: "b", actionLabel: "go", url: 'https://x/"><script>' });
    expect(html).not.toContain("<b>hi</b>");
    expect(html).not.toContain('"><script>');
  });

  it("redacts addresses", () => {
    expect(redactEmail("ada@example.com")).toBe("a***@example.com");
  });
});
