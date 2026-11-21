"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import {
  submitRegistration,
  decideRegistration,
  publishRegistration,
  publishRegistrationDocument,
} from "@/app/(portal)/registration/actions";
import type { OpenSeason } from "@/lib/registration-schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RegistrationState } from "@/app/(portal)/registration/actions";

const initial: RegistrationState = { error: false, message: "" };

type RegistrationDocument = {
  id: string;
  season_id: string;
  document_type: "waiver" | "code_of_conduct";
  title: string;
  version: number;
  url: string | null;
};

export function RegistrationForm({
  seasons,
  documents,
  name,
  teams = [],
}: {
  seasons: OpenSeason[];
  documents: RegistrationDocument[];
  name?: string;
  teams?: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(submitRegistration, initial);
  const [selectedSeason, setSelectedSeason] = useState("");

  const currentDocuments = documents.filter(
    (document) => document.season_id === selectedSeason
  );
  const hasWaiver = currentDocuments.some(
    (document) => document.document_type === "waiver"
  );
  const canSignDocuments =
    hasWaiver && currentDocuments.every((document) => document.url !== null);

  return (
    <form action={action} className="panel form-stack registration-panel">
      <div>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "1.3rem" }}>
          Apply for an Open Season
        </h2>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
          Submit your player registration, accept required waivers, and select your preferences.
        </p>
      </div>

      <label style={{ display: "grid", gap: "6px" }}>
        <span style={{ fontWeight: 600 }}>Select Season</span>
        <select
          name="season_id"
          required
          value={selectedSeason}
          onChange={(event) => setSelectedSeason(event.target.value)}
        >
          <option value="" disabled>
            Choose a season...
          </option>
          {seasons.map((s) => (
            <option key={s.season_id} value={s.season_id}>
              {s.league_name} · {s.season_name} (Registration closes {s.closes} UTC)
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontWeight: 600 }}>Player Name</span>
          <input
            name="display_name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={name ?? ""}
            readOnly={!!name}
            placeholder="First and Last Name"
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontWeight: 600 }}>Primary Position</span>
          <select name="position" defaultValue="F">
            {["C", "LW", "RW", "D", "G", "F"].map((p) => (
              <option key={p} value={p}>
                {p === "C" ? "Center (C)" :
                 p === "LW" ? "Left Wing (LW)" :
                 p === "RW" ? "Right Wing (RW)" :
                 p === "D" ? "Defense (D)" :
                 p === "G" ? "Goalie (G)" : "Forward (F)"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Team Preference & Payment Model Selection */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontWeight: 600 }}>Team Selection</span>
          <select
            name="preferred_team"
            defaultValue="Free Agent / Unassigned"
            style={{ width: "100%", background: "#13232e", border: "1px solid var(--line)", borderRadius: "6px", padding: "8px 12px", color: "var(--text)", fontSize: "13.5px" }}
          >
            <option value="Free Agent / Unassigned">Free Agent / Unassigned (Place me on a team)</option>
            {teams && teams.length > 0 && (
              <optgroup label="Registered Teams">
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontWeight: 600 }}>Payment Method</span>
          <select name="payment_preference" defaultValue="online_individual">
            <option value="online_individual">Pay Online Individually (Card / Portal)</option>
            <option value="offline_tracked">Pay Offline (e-Transfer / Cheque / Cash)</option>
            <option value="manager_pays">Team Manager Pays on Behalf of Team</option>
          </select>
        </label>
      </div>

      {!selectedSeason ? (
        <div className="notice" style={{ borderRadius: "8px", margin: "8px 0" }}>
          ℹ️ Select an available season above to review its policies and required waivers.
        </div>
      ) : !hasWaiver ? (
        <div className="notice" style={{ borderRadius: "8px", margin: "8px 0", color: "#fca5a5" }}>
          ⚠️ This season has no published waiver yet. Applications require an approved waiver from the league commissioner.
        </div>
      ) : (
        <>
          <fieldset className="consent-group">
            <legend>Required Documentation &amp; Waivers</legend>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {currentDocuments.map((document) => (
                <label className="consent-option" key={document.id}>
                  <input
                    type="checkbox"
                    name="document_ids"
                    value={document.id}
                    required
                    disabled={!document.url}
                  />
                  <span>
                    I have reviewed and agree to{" "}
                    {document.url ? (
                      <a
                        className="text-link"
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "underline" }}
                      >
                        📄 {document.title} (v{document.version})
                      </a>
                    ) : (
                      <strong style={{ color: "#ef4444" }}>
                        {document.title} (v{document.version}) - PDF unavailable
                      </strong>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {!canSignDocuments && (
            <p role="alert" style={{ color: "#ef4444", fontSize: "0.85rem" }}>
              A required document could not be loaded. Please contact the commissioner before applying.
            </p>
          )}

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontWeight: 600 }}>Electronic Signature</span>
            <input
              name="signer_name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              placeholder="Type your full legal name to electronically sign"
            />
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Typing your legal name records your agreement to the exact document versions above.
            </span>
          </label>

          <fieldset className="consent-group">
            <legend>Optional Permissions &amp; Privacy</legend>
            <div style={{ display: "grid", gap: "10px" }}>
              <ConsentChoice
                name="consent_public_profile"
                label="Public Profile Listing"
                description="Allow your player name and stats to appear in public standings and leaderboards."
              />
              <ConsentChoice
                name="consent_filming"
                label="Game Broadcast & Highlights"
                description="Allow video streams and highlights featuring you to be broadcast across the network."
              />
              <ConsentChoice
                name="consent_marketing"
                label="League Announcements & Updates"
                description="Receive occasional notifications about upcoming tournaments and season registrations."
              />
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "10px 0 0 0" }}>
              Each permission is optional and defaults to No. You can update these choices later in your account.
            </p>
          </fieldset>
        </>
      )}

      <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "8px 0" }}>
        League commissioners review applications directly. Approval grants season eligibility and team placement access.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
        <button
          type="submit"
          className="button primary"
          style={{ minWidth: "180px", padding: "12px 24px" }}
          disabled={pending || !seasons.length || !canSignDocuments}
        >
          {pending ? "Submitting Application…" : "Submit Application →"}
        </button>

        {state.message && (
          <p
            role="status"
            className={`form-message ${state.error ? "error" : ""}`}
            style={{ margin: 0 }}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function ConsentChoice({
  name,
  label,
  description,
}: {
  name: string;
  label: string;
  description: string;
}) {
  const [val, setVal] = useState("no");

  return (
    <div className="consent-choice">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div>
          <strong style={{ fontSize: "0.9rem", color: "var(--text)" }}>{label}</strong>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "2px 0 0 0" }}>{description}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <label
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: val === "no" ? "#334155" : "transparent",
              border: val === "no" ? "1px solid #64748b" : "1px solid var(--line)",
              cursor: "pointer",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <input
              type="radio"
              name={name}
              value="no"
              checked={val === "no"}
              onChange={() => setVal("no")}
              required
            />
            No
          </label>
          <label
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: val === "yes" ? "#15803d" : "transparent",
              border: val === "yes" ? "1px solid #22c55e" : "1px solid var(--line)",
              cursor: "pointer",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <input
              type="radio"
              name={name}
              value="yes"
              checked={val === "yes"}
              onChange={() => setVal("yes")}
            />
            Yes
          </label>
        </div>
      </div>
    </div>
  );
}

export function RegistrationDocumentUpload({
  leagueId,
  seasons,
}: {
  leagueId: string;
  seasons: { id: string; name: string }[];
}) {
  const [state, setState] = useState<RegistrationState>(initial);
  const [pending, startTransition] = useTransition();

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get("file");

    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) {
      setState({ error: true, message: "Choose a PDF file no larger than 10 MB." });
      return;
    }
    const header = new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer());
    if (!header.includes("%PDF-")) {
      setState({ error: true, message: "The selected file is not a valid PDF." });
      return;
    }

    const seasonId = String(values.get("season_id") ?? "");
    const documentId = crypto.randomUUID();
    const objectPath = `${leagueId}/${seasonId}/${documentId}.pdf`;

    setState(initial);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.storage
        .from("league-documents")
        .upload(objectPath, file, { contentType: "application/pdf", upsert: false });

      if (error) {
        setState({
          error: true,
          message: "The PDF could not be uploaded. Check your commissioner access and try again.",
        });
        return;
      }

      const metadata = new FormData();
      metadata.set("season_id", seasonId);
      metadata.set("document_id", documentId);
      metadata.set("document_type", String(values.get("document_type") ?? ""));
      metadata.set("title", String(values.get("title") ?? ""));
      metadata.set("object_path", objectPath);
      metadata.set("file_name", file.name);

      const result = await publishRegistrationDocument(initial, metadata);
      setState(result);
      if (!result.error) form.reset();
    });
  }

  return (
    <form onSubmit={upload} className="panel form-stack">
      <div>
        <h3 style={{ margin: "0 0 4px 0" }}>Publish League Policy or Waiver</h3>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          Upload an approved PDF. Earlier acceptance records are permanently retained for audit purposes.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Target Season</span>
          <select name="season_id" required defaultValue="">
            <option value="" disabled>
              Select season...
            </option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span>Document Type</span>
          <select name="document_type" required defaultValue="waiver">
            <option value="waiver">Player Liability Waiver</option>
            <option value="code_of_conduct">Code of Conduct &amp; Ethics</option>
          </select>
        </label>
      </div>

      <label style={{ display: "grid", gap: "6px" }}>
        <span>Document Title</span>
        <input name="title" required minLength={2} maxLength={120} placeholder="e.g. 2026 Winter Season Waiver" />
      </label>

      <label style={{ display: "grid", gap: "6px" }}>
        <span>PDF Document File</span>
        <input name="file" type="file" accept="application/pdf,.pdf" required />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
        <button
          type="submit"
          className="button primary"
          style={{ padding: "10px 20px" }}
          disabled={pending || !seasons.length}
        >
          {pending ? "Uploading Version…" : "Upload & Publish Version"}
        </button>
        {state.message && (
          <p
            role="status"
            className={`form-message ${state.error ? "error" : ""}`}
            style={{ margin: 0 }}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function RegistrationDecision({
  id,
  revision,
  review = false,
}: {
  id: string;
  revision: number;
  review?: boolean;
}) {
  const [state, action, pending] = useActionState(decideRegistration, initial);

  return (
    <form action={action} className="form-stack">
      <input type="hidden" name="registration_id" value={id} />
      <input type="hidden" name="revision" value={revision} />

      {review ? (
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Decision Action</span>
          <select name="decision">
            <option value="approved">Approve Registration</option>
            <option value="rejected">Reject Application</option>
          </select>
        </label>
      ) : (
        <input type="hidden" name="decision" value="withdrawn" />
      )}

      <label style={{ display: "grid", gap: "6px" }}>
        <span>{review ? "Decision Note (visible to applicant)" : "Reason for Withdrawing"}</span>
        <input
          name="reason"
          required
          minLength={3}
          maxLength={500}
          placeholder={review ? "e.g. Verified eligibility and waivers" : "e.g. Schedule conflict"}
        />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          type="submit"
          className={`button ${review ? "primary" : "button-danger"}`}
          style={{ padding: "8px 18px" }}
          disabled={pending}
        >
          {pending ? "Saving…" : review ? "Confirm Decision" : "Withdraw Application"}
        </button>
        {state.message && (
          <p
            role="status"
            className={`form-message ${state.error ? "error" : ""}`}
            style={{ margin: 0 }}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function RegistrationPublication({
  seasonId,
  revision,
  enabled,
}: {
  seasonId: string;
  revision: number;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(publishRegistration, initial);

  return (
    <form action={action}>
      <input type="hidden" name="season_id" value={seasonId} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="enabled" value={String(!enabled)} />
      <button
        type="submit"
        className={`button ${enabled ? "button-danger" : "primary"}`}
        style={{ padding: "8px 18px" }}
        disabled={pending}
      >
        {pending ? "Saving…" : enabled ? "Close Applications" : "Open Registration"}
      </button>
      {state.message && <p role="status" style={{ margin: "6px 0 0 0", fontSize: "0.85rem" }}>{state.message}</p>}
    </form>
  );
}
