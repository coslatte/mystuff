import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { api, ApiError } from "../services/api";

type FormState =
  | { kind: "editing" }
  | { kind: "submitting"; slow: boolean }
  | { kind: "accepted"; reference: string }
  | { kind: "error"; message: string; fields: Record<string, string> };

const fieldClass = "mt-2 w-full border-2 border-black bg-white px-4 py-3 font-mono text-base tablet:text-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-black disabled:opacity-60";

export default function ContactForm() {
  const [state, setState] = useState<FormState>({ kind: "editing" });
  const [ready, setReady] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const submission = useRef<{ content: string; id: string } | null>(null);
  const busy = state.kind === "submitting";

  useEffect(() => {
    setReady(true);
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    if (state.kind === "accepted") status.current?.focus();
    if (state.kind === "error") {
      const first = form.current?.elements.namedItem(Object.keys(state.fields)[0] ?? "");
      if (first instanceof HTMLElement) first.focus();
      else status.current?.focus();
    }
  }, [state]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current) return;
    const element = event.currentTarget;
    const data = new FormData(element);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const website = String(data.get("website") ?? "");
    const fields: Record<string, string> = {};
    if (!name) fields.name = "Enter your name.";
    if (message.length < 10) fields.message = "Write at least 10 characters.";
    if (Object.keys(fields).length) {
      setState({ kind: "error", message: "Review the highlighted fields.", fields });
      return;
    }
    const content = JSON.stringify({ name, email, message, website });
    if (submission.current?.content !== content) submission.current = { content, id: crypto.randomUUID() };
    const active = new AbortController();
    controller.current = active;
    setState({ kind: "submitting", slow: false });
    const slow = setTimeout(() => setState(previous => previous.kind === "submitting"
      ? { kind: "submitting", slow: true } : previous), 10000);
    const timeout = setTimeout(() => active.abort(), 90000);
    try {
      const receipt = await api.submitContactMessage({ submissionId: submission.current.id, name, email, message, website }, active.signal);
      if (controller.current !== active) return;
      element.reset();
      submission.current = null;
      setState({ kind: "accepted", reference: receipt.messageId });
    } catch (error) {
      if (controller.current !== active) return;
      const fieldErrors: Record<string, string> = {};
      if (error instanceof ApiError && typeof error.details === "object" && error.details !== null) {
        for (const [field, detail] of Object.entries(error.details)) {
          if (["name", "email", "message"].includes(field) && typeof detail === "string") fieldErrors[field] = detail;
        }
      }
      const explanation = error instanceof ApiError && error.status !== 0
        ? error.message
        : "We could not confirm receipt. Your text is still here. Retry with the same content to avoid duplicates; editing it creates a new submission.";
      setState({ kind: "error", message: explanation, fields: fieldErrors });
    } finally {
      clearTimeout(slow);
      clearTimeout(timeout);
      if (controller.current === active) controller.current = null;
    }
  }

  function fieldError(field: string) {
    return state.kind === "error" ? state.fields[field] : undefined;
  }

  return (
    <form ref={form} onSubmit={submit} className="min-w-0 max-w-3xl" aria-busy={busy}>
      <fieldset disabled={!ready || busy} className="grid min-w-0 gap-6">
        <div className="grid min-w-0 gap-6 tablet:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="contact-name" className="brut-label">Name</label>
            <input id="contact-name" name="name" autoComplete="name" required maxLength={100} className={fieldClass}
              aria-invalid={Boolean(fieldError("name"))} aria-describedby={fieldError("name") ? "contact-name-error" : undefined} />
            {fieldError("name") && <p id="contact-name-error" className="mt-2 text-sm">{fieldError("name")}</p>}
          </div>
          <div className="min-w-0">
            <label htmlFor="contact-email" className="brut-label">Email</label>
            <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} className={fieldClass}
              aria-invalid={Boolean(fieldError("email"))} aria-describedby={fieldError("email") ? "contact-email-error" : undefined} />
            {fieldError("email") && <p id="contact-email-error" className="mt-2 text-sm">{fieldError("email")}</p>}
          </div>
        </div>
        <div className="min-w-0">
          <label htmlFor="contact-message" className="brut-label">Message</label>
          <textarea id="contact-message" name="message" required minLength={10} maxLength={5000} rows={8} className={fieldClass}
            aria-invalid={Boolean(fieldError("message"))}
            aria-describedby={fieldError("message") ? "contact-message-error contact-message-hint" : "contact-message-hint"} />
          <p id="contact-message-hint" className="mt-2 font-mono text-xs text-neutral-600">10–5,000 characters.</p>
          {fieldError("message") && <p id="contact-message-error" className="mt-2 text-sm">{fieldError("message")}</p>}
        </div>
        <div hidden aria-hidden="true">
          <label htmlFor="contact-website">Leave this empty</label>
          <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <p className="text-sm leading-6 text-neutral-700">
          Your details are used to deliver this message and reply to you. The site removes successfully processed
          messages after 30 days; failed deliveries remain for review. Email providers, backups, and the recipient's mailbox keep their own copies.
        </p>
        <button type="submit" className="brut-up min-h-11 w-full disabled:cursor-wait disabled:opacity-60 tablet:w-fit">
          <span>{busy ? "Sending…" : "Send message ↗"}</span>
        </button>
      </fieldset>
      <div ref={status} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className="mt-6 outline-offset-4">
        {state.kind === "submitting" && <p className="font-mono text-sm">{state.slow
          ? "The service is taking a little longer to respond. Please keep this page open; your message is still here."
          : "Submitting your message…"}</p>}
        {state.kind === "error" && <p className="border-2 border-black bg-white p-4 text-sm">{state.message}</p>}
        {state.kind === "accepted" && <div className="border-2 border-black bg-brut-yellow p-4">
          <p className="font-bold">Your message has been received for delivery.</p>
          <p className="mt-2 break-all font-mono text-xs">Reference: {state.reference}</p>
        </div>}
      </div>
    </form>
  );
}
