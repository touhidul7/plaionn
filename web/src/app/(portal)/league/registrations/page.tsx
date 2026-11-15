import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";
import {
  RegistrationDecision,
  RegistrationPublication,
  RegistrationDocumentUpload,
} from "@/components/registration-forms";
import { sanitizeSeasonName } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export default async function ReviewRegistrations() {
  const { supabase, league, canManage } = await getLeagueContext();
  if (!canManage) {
    return (
      <section className="panel">
        <h1>Commissioner access required</h1>
      </section>
    );
  }

  const [seasons, settings, requests] = await Promise.all([
    supabase.from("seasons").select("id,name").eq("league_id", league.id),
    supabase
      .from("season_settings")
      .select("season_id,revision,registration_enabled,registration_opens,registration_closes")
      .eq("league_id", league.id),
    supabase
      .from("player_registrations")
      .select("id,season_id,player_id,status,position,revision,created_at")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false }),
  ]);

  if (seasons.error || settings.error || requests.error) {
    return (
      <section className="panel">
        <h1>Registration unavailable</h1>
        <p>Please complete registration database setup and try again.</p>
      </section>
    );
  }

  const sanitizedSeasons = seasons.data.map((s) => ({
    ...s,
    name: sanitizeSeasonName(s.name),
  }));

  const profiles = requests.data.length
    ? await supabase
        .from("players")
        .select("id,display_name")
        .in(
          "id",
          requests.data.map((r) => r.player_id)
        )
    : { data: [], error: null };

  if (profiles.error) {
    return (
      <section className="panel">
        <h1>Applicants could not be loaded</h1>
        <p>Please reload and try again.</p>
      </section>
    );
  }

  const [documents, acceptances, consents] = await Promise.all([
    supabase
      .from("season_documents")
      .select("id,season_id,document_type,title,version,object_path,file_name,created_at")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false }),
    requests.data.length
      ? supabase
          .from("registration_document_acceptances")
          .select("id,registration_id,document_title,document_version,signer_name,accepted_at")
          .in(
            "registration_id",
            requests.data.map((r) => r.id)
          )
          .order("accepted_at", { ascending: false })
      : { data: [], error: null },
    requests.data.length
      ? supabase
          .from("registration_consents")
          .select("id,registration_id,consent_type,consent_text,granted,recorded_at")
          .in(
            "registration_id",
            requests.data.map((r) => r.id)
          )
          .order("recorded_at", { ascending: false })
      : { data: [], error: null },
  ]);

  if (documents.error) {
    return (
      <section className="panel">
        <h1>Documents unavailable</h1>
        <p>Reload the page or check the document migration and private Storage bucket setup.</p>
      </section>
    );
  }

  const documentLinks = await Promise.all(
    documents.data.map(async (document) => {
      const { data, error } = await supabase.storage
        .from("league-documents")
        .createSignedUrl(document.object_path, 600);
      return { ...document, url: error || !data ? null : data.signedUrl };
    })
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LEAGUE REGISTRATION</p>
          <h1>Welcome your players.</h1>
          <p>{league.name}</p>
        </div>
        <Link className="button" href="/league/settings">
          Season settings
        </Link>
      </div>

      <section className="panel">
        <h2>Required documents</h2>
        <p>
          Upload the league’s approved waiver before registration. Each upload creates an immutable
          version, and players must accept the latest waiver and any current code of conduct.
        </p>
        <RegistrationDocumentUpload leagueId={league.id} seasons={sanitizedSeasons} />
        {!documentLinks.length && <p>No documents have been published.</p>}
        {documentLinks.map((document) => (
          <div className="list-row" key={document.id}>
            <strong>{document.title}</strong>
            <p>
              {sanitizedSeasons.find((season) => season.id === document.season_id)?.name} ·{" "}
              {document.document_type.replace("_", " ")} · version {document.version} ·{" "}
              {document.file_name}
            </p>
            {document.url ? (
              <a className="text-link" href={document.url} target="_blank" rel="noreferrer">
                Review PDF ↗
              </a>
            ) : (
              <p role="alert">PDF unavailable. Check the private Storage policies.</p>
            )}
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Registration windows</h2>
        <p>
          Set opening and closing dates in Season settings, then publish. Dates are inclusive and use
          UTC. Published seasons are discoverable by signed-in applicants.
        </p>
        {sanitizedSeasons.map((season) => {
          const config = settings.data.find((s) => s.season_id === season.id);
          return (
            <div className="list-row" key={season.id}>
              <h3>{season.name}</h3>
              {config ? (
                <>
                  <p>
                    {config.registration_opens ?? "Opening date unset"} –{" "}
                    {config.registration_closes ?? "Closing date unset"} ·{" "}
                    {config.registration_enabled ? "Published" : "Closed"}
                  </p>
                  <RegistrationPublication
                    seasonId={season.id}
                    revision={config.revision}
                    enabled={config.registration_enabled}
                  />
                </>
              ) : (
                <p>Save this season’s settings first.</p>
              )}
            </div>
          );
        })}
      </section>

      <div className="section-heading">
        <h2>Applications</h2>
        <span>
          Approval creates player membership in this league. Team assignment is done on team rosters.
        </span>
      </div>

      {!requests.data.length && (
        <section className="panel empty">
          <h2>No applications yet</h2>
          <p>When players register for an open season, their applications will appear here for review.</p>
        </section>
      )}

      {requests.data.map((r) => (
        <section className="panel" key={r.id}>
          <h3>
            {profiles.data?.find((p) => p.id === r.player_id)?.display_name ?? "Player"}{" "}
            <small>({r.player_id.slice(0, 8)})</small>
          </h3>
          <p>
            {sanitizedSeasons.find((s) => s.id === r.season_id)?.name} · Position: {r.position} ·{" "}
            <span className="badge">{r.status.toUpperCase()}</span>
          </p>

          {r.status === "pending" && (
            <div style={{ marginTop: "14px" }}>
              <RegistrationDecision id={r.id} revision={r.revision} review />
            </div>
          )}

          {acceptances.error ? (
            <p>Document acceptance history could not be loaded.</p>
          ) : (
            <>
              <h4>Signed documents</h4>
              {acceptances.data
                ?.filter((a) => a.registration_id === r.id)
                .map((a) => (
                  <p key={a.id}>
                    {a.document_title} v{a.document_version} · Signer: {a.signer_name} · Date:{" "}
                    {a.accepted_at}
                  </p>
                ))}
            </>
          )}

          {consents.error ? (
            <p>Consent history could not be loaded.</p>
          ) : (
            <>
              <h4>Consents</h4>
              {consents.data
                ?.filter((c) => c.registration_id === r.id)
                .map((c) => (
                  <p key={c.id}>
                    {c.consent_type.replace("_", " ")}: {c.granted ? "Yes" : "No"} · {c.consent_text}
                  </p>
                ))}
            </>
          )}
        </section>
      ))}
    </>
  );
}
