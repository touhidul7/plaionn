"use client";

import { useState } from "react";
import { sanitizePlayerName } from "@/lib/sanitize";

interface StreamItem {
  id: string;
  provider: string;
  url: string;
  title: string;
  camera_angle: string;
  is_live: boolean;
}

interface HighlightItem {
  id: string;
  title: string;
  clip_url: string;
  thumbnail_url?: string;
  tag: string;
  start_seconds: number;
  duration_seconds: number;
  player_name?: string;
  views: number;
}

interface StoryItem {
  id: string;
  title: string;
  caption?: string;
  aspect_ratio: string;
  media_url: string;
  thumbnail_url?: string;
  duration_seconds: number;
  sequence_order: number;
  view_count: number;
  like_count: number;
  tagged_players?: Array<{
    player_id: string;
    display_name: string;
  }>;
}

interface VideoPackageProps {
  streams: StreamItem[];
  highlights: HighlightItem[];
  stories?: StoryItem[];
}

export function GameVideoPackage({ streams, highlights, stories = [] }: VideoPackageProps) {
  const [activeClip, setActiveClip] = useState<HighlightItem | null>(null);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);

  if (streams.length === 0 && highlights.length === 0 && stories.length === 0) {
    return (
      <div
        className="panel"
        style={{
          marginTop: "1.5rem",
          padding: "16px 20px",
          background: "#0c1822",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "1.3rem", opacity: 0.7 }}>📹</span>
        <div>
          <strong style={{ fontSize: "0.9rem", color: "var(--text)", display: "block" }}>
            Broadcast &amp; Video Highlights Not Available
          </strong>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            No media broadcast feed was scheduled for this matchup. Real-time scores and official game events remain active.
          </span>
        </div>
      </div>
    );
  }

  const primaryStream = streams[0];

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div className="section-heading" style={{ marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.2rem" }}>📺</span>
          <h2 style={{ margin: 0 }}>Game Broadcast &amp; Highlights</h2>
          {primaryStream?.is_live && (
            <span
              className="badge"
              style={{
                background: "#e02424",
                color: "#ffffff",
                fontWeight: "bold",
                letterSpacing: "0.05em",
                animation: "pulse 2s infinite",
              }}
            >
              ● LIVE
            </span>
          )}
        </div>
        <span>High-definition video feed and instant event replays</span>
      </div>

      {/* Main Broadcast or Active Clip Player */}
      {primaryStream && !activeClip && (
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: "12px",
            overflow: "hidden",
            background: "#0b0f19",
            aspectRatio: "16 / 9",
            maxHeight: "480px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
          }}
        >
          {primaryStream.url.includes("youtube.com") || primaryStream.url.includes("youtu.be") ? (
            <iframe
              src={
                primaryStream.url.includes("watch?v=")
                  ? primaryStream.url.replace("watch?v=", "embed/")
                  : primaryStream.url
              }
              title={primaryStream.title}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={primaryStream.url}
              controls
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}
        </div>
      )}

      {/* Active Clip Playback Modal / Overlay */}
      {activeClip && (
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: "12px",
            overflow: "hidden",
            background: "#000",
            aspectRatio: "16 / 9",
            maxHeight: "480px",
            marginBottom: "1rem",
          }}
        >
          <video
            src={activeClip.clip_url}
            controls
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          <button
            onClick={() => setActiveClip(null)}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "6px",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            ✕ Close Replay
          </button>
        </div>
      )}

      {/* Highlight Clips Carousel / Row */}
      {highlights.length > 0 && (
        <div>
          <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: "8px" }}>
            Replay Clips ({highlights.length})
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            {highlights.map((h) => (
              <div
                key={h.id}
                onClick={() => setActiveClip(h)}
                style={{
                  background: activeClip?.id === h.id ? "#1e293b" : "var(--panel-bg, #ffffff)",
                  border: activeClip?.id === h.id ? "2px solid #3b82f6" : "1px solid var(--border-color, #e5e7eb)",
                  borderRadius: "8px",
                  padding: "10px",
                  cursor: "pointer",
                  transition: "transform 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span
                      className="badge"
                      style={{
                        fontSize: "0.7rem",
                        background: h.tag === "goal" ? "#dcfce7" : "#e0e7ff",
                        color: h.tag === "goal" ? "#166534" : "#3730a3",
                      }}
                    >
                      {h.tag.replace("_", " ").toUpperCase()}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#888" }}>
                      ⏱ {h.duration_seconds}s
                    </span>
                  </div>
                  <strong style={{ fontSize: "0.9rem", lineHeight: "1.3", display: "block" }}>
                    {h.title}
                  </strong>
                  {h.player_name && (
                    <span className="hint" style={{ fontSize: "0.8rem", marginTop: "4px", display: "block" }}>
                      ⭐ {sanitizePlayerName(h.player_name)}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", color: "#3b82f6", fontSize: "0.8rem", fontWeight: "bold" }}>
                  ▶ Watch Clip
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vertical Mobile Story Highlights */}
      {stories.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>📱</span> Vertical Story Reels ({stories.length})
          </h3>
          <div
            style={{
              display: "flex",
              gap: "12px",
              overflowX: "auto",
              paddingBottom: "8px",
            }}
          >
            {stories.map((story) => (
              <div
                key={story.id}
                onClick={() => setActiveStory(story)}
                style={{
                  minWidth: "140px",
                  maxWidth: "140px",
                  height: "220px",
                  borderRadius: "12px",
                  background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                  border: activeStory?.id === story.id ? "2px solid #ec4899" : "1px solid #334155",
                  padding: "10px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  color: "#ffffff",
                  position: "relative",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      background: "rgba(236, 72, 153, 0.8)",
                      fontSize: "0.65rem",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: 600,
                    }}
                  >
                    9:16
                  </span>
                  <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>
                    {story.duration_seconds}s
                  </span>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      margin: "0 0 4px 0",
                      lineHeight: "1.2",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {story.title}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.7rem", opacity: 0.85 }}>
                    <span>👀 {story.view_count}</span>
                    <span>❤️ {story.like_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Active Story Modal / Preview */}
          {activeStory && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                borderRadius: "12px",
                background: "#0f172a",
                color: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <strong>📱 {activeStory.title}</strong>
                <button
                  type="button"
                  onClick={() => setActiveStory(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  ✕ Close Reel
                </button>
              </div>
              <div
                style={{
                  width: "240px",
                  height: "426px",
                  borderRadius: "16px",
                  overflow: "hidden",
                  background: "#000000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                  border: "2px solid #334155",
                }}
              >
                {activeStory.media_url.endsWith(".mp4") || activeStory.media_url.includes("video") ? (
                  <video
                    src={activeStory.media_url}
                    controls
                    autoPlay
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <iframe
                    src={activeStory.media_url}
                    title={activeStory.title}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
              {activeStory.caption && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#cbd5e1", textAlign: "center" }}>
                  {activeStory.caption}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
