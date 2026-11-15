export function Skeleton({
  className = "",
  style,
  width,
  height,
}: {
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function PageHeaderSkeleton({ actionButtons = 2 }: { actionButtons?: number }) {
  return (
    <div className="page-heading" style={{ marginBottom: "28px" }}>
      <div style={{ width: "100%", maxWidth: "450px" }}>
        <Skeleton height="12px" width="100px" style={{ marginBottom: "10px", borderRadius: "4px" }} />
        <Skeleton height="34px" width="280px" style={{ marginBottom: "8px", borderRadius: "8px" }} />
        <Skeleton height="14px" width="220px" style={{ borderRadius: "4px" }} />
      </div>
      {actionButtons > 0 && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {Array.from({ length: actionButtons }).map((_, i) => (
            <Skeleton key={i} height="38px" width={i === 0 ? "110px" : "130px"} style={{ borderRadius: "10px" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// 1. Player Hub Skeleton (/dashboard)
export function PlayerDashboardSkeleton() {
  return (
    <div className="public-portal-container" role="status" aria-label="Loading player dashboard">
      <PageHeaderSkeleton actionButtons={3} />

      {/* 5 Stats Cards Grid */}
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <Skeleton height="20px" width="240px" style={{ marginBottom: "1rem" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ background: "#0c1822", border: "1px solid var(--line)", padding: "1.2rem 1rem", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <Skeleton height="12px" width="80px" style={{ borderRadius: "4px" }} />
              <Skeleton height="32px" width="50px" style={{ borderRadius: "6px" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Matchups Grid */}
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <Skeleton height="20px" width="200px" />
          <Skeleton height="16px" width="100px" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "1.2rem", background: "#0c1822", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Skeleton height="12px" width="90px" />
                <Skeleton height="12px" width="60px" />
              </div>
              <Skeleton height="20px" width="180px" />
              <Skeleton height="14px" width="130px" />
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid var(--line)" }}>
                <Skeleton height="22px" width="80px" style={{ borderRadius: "12px" }} />
                <Skeleton height="28px" width="90px" style={{ borderRadius: "6px" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teams Table */}
      <div className="panel">
        <Skeleton height="20px" width="220px" style={{ marginBottom: "1rem" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", gap: "16px", paddingBottom: "8px", borderBottom: "1px solid var(--line)" }}>
            <Skeleton height="12px" width="160px" />
            <Skeleton height="12px" width="120px" />
            <Skeleton height="12px" width="140px" />
            <Skeleton height="12px" width="60px" />
            <Skeleton height="12px" width="60px" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "16px", padding: "8px 0" }}>
              <Skeleton height="16px" width="160px" />
              <Skeleton height="16px" width="120px" />
              <Skeleton height="16px" width="140px" />
              <Skeleton height="16px" width="60px" />
              <Skeleton height="16px" width="60px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 2. Schedule & Scores Skeleton (/schedule)
export function SchedulePageSkeleton() {
  return (
    <div className="public-portal-container" role="status" aria-label="Loading game schedules">
      <PageHeaderSkeleton actionButtons={2} />

      {/* Filter / Calendar Tabs Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", alignItems: "center" }}>
        <Skeleton height="40px" width="240px" style={{ borderRadius: "8px" }} />
        <Skeleton height="40px" width="160px" style={{ borderRadius: "8px" }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <Skeleton height="36px" width="36px" style={{ borderRadius: "8px" }} />
          <Skeleton height="36px" width="36px" style={{ borderRadius: "8px" }} />
        </div>
      </div>

      {/* Scoreboard Cards Grid */}
      <div className="scoreboard-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="score-card" style={{ padding: "16px", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Skeleton height="11px" width="90px" />
              <Skeleton height="18px" width="50px" style={{ borderRadius: "10px" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Skeleton height="20px" width="20px" style={{ borderRadius: "50%" }} />
                <Skeleton height="15px" width="100px" />
              </div>
              <Skeleton height="22px" width="24px" style={{ borderRadius: "4px" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Skeleton height="20px" width="20px" style={{ borderRadius: "50%" }} />
                <Skeleton height="15px" width="110px" />
              </div>
              <Skeleton height="22px" width="24px" style={{ borderRadius: "4px" }} />
            </div>
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
              <Skeleton height="12px" width="110px" />
              <Skeleton height="12px" width="70px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Standings Table Skeleton (/standings)
export function StandingsPageSkeleton() {
  return (
    <div className="public-portal-container" role="status" aria-label="Loading standings">
      <PageHeaderSkeleton actionButtons={1} />

      {/* Division Picker Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <Skeleton height="36px" width="130px" style={{ borderRadius: "8px" }} />
        <Skeleton height="36px" width="130px" style={{ borderRadius: "8px" }} />
        <Skeleton height="36px" width="130px" style={{ borderRadius: "8px" }} />
      </div>

      {/* Standings Table */}
      <div className="panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <Skeleton height="20px" width="180px" />
          <Skeleton height="14px" width="120px" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "40px 2fr repeat(8, 1fr)", gap: "12px", paddingBottom: "10px", borderBottom: "1px solid var(--line)" }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} height="12px" style={{ borderRadius: "4px" }} />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 8 }).map((_, r) => (
            <div key={r} style={{ display: "grid", gridTemplateColumns: "40px 2fr repeat(8, 1fr)", gap: "12px", alignItems: "center", padding: "8px 0" }}>
              <Skeleton height="14px" width="16px" />
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Skeleton height="22px" width="22px" style={{ borderRadius: "4px" }} />
                <Skeleton height="15px" width="120px" />
              </div>
              {Array.from({ length: 8 }).map((_, c) => (
                <Skeleton key={c} height="14px" width="30px" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 4. Leaders Page Skeleton (/leaders)
export function LeadersPageSkeleton() {
  return (
    <div className="public-portal-container" role="status" aria-label="Loading scoring leaders">
      <PageHeaderSkeleton actionButtons={2} />

      {/* Top 3 Podium Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel" style={{ padding: "24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <Skeleton height="60px" width="60px" style={{ borderRadius: "50%" }} />
            <Skeleton height="20px" width="120px" />
            <Skeleton height="14px" width="80px" />
            <Skeleton height="28px" width="60px" style={{ borderRadius: "6px" }} />
          </div>
        ))}
      </div>

      {/* Full Leaderboard Table */}
      <div className="panel" style={{ padding: "20px" }}>
        <Skeleton height="20px" width="180px" style={{ marginBottom: "16px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {Array.from({ length: 7 }).map((_, r) => (
            <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Skeleton height="16px" width="20px" />
                <Skeleton height="16px" width="140px" />
                <Skeleton height="14px" width="80px" />
              </div>
              <div style={{ display: "flex", gap: "24px" }}>
                <Skeleton height="16px" width="40px" />
                <Skeleton height="16px" width="40px" />
                <Skeleton height="16px" width="40px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 5. Teams Directory Skeleton (/teams)
export function TeamsPageSkeleton() {
  return (
    <div className="public-portal-container" role="status" aria-label="Loading teams directory">
      <PageHeaderSkeleton actionButtons={2} />

      {/* Team Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="panel" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Skeleton height="40px" width="40px" style={{ borderRadius: "8px" }} />
              <div>
                <Skeleton height="18px" width="120px" style={{ marginBottom: "4px" }} />
                <Skeleton height="12px" width="70px" />
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", display: "flex", justifyContent: "space-between" }}>
              <Skeleton height="13px" width="90px" />
              <Skeleton height="13px" width="60px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 6. Generic Fallback Page Skeleton
export function PortalPageSkeleton() {
  return (
    <div className="public-portal-container" role="status" aria-label="Loading page content">
      <PageHeaderSkeleton />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <Skeleton height="12px" width="70px" />
            <Skeleton height="28px" width="90px" />
            <Skeleton height="12px" width="110px" />
          </div>
        ))}
      </div>
      <div className="panel" style={{ padding: "20px" }}>
        <Skeleton height="20px" width="160px" style={{ marginBottom: "16px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <Skeleton height="14px" width="180px" />
              <Skeleton height="14px" width="100px" />
              <Skeleton height="14px" width="80px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
