"use client";

import { useState } from "react";

export interface ClipItem {
  id: string;
  title: string;
  team: string;
  timeAgo: string;
  durationSeconds: number;
  videoUrl: string;
  thumbnailBg: string;
  likes: number;
  caption: string;
  taggedPlayer?: string;
}

const DEFAULT_CLIPS: ClipItem[] = [
  {
    id: "clip-1",
    title: "Opening Faceoff & Fast Rush",
    team: "Northline HC",
    timeAgo: "1h ago",
    durationSeconds: 15,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnailBg: "linear-gradient(180deg, rgba(9,18,25,0.2) 0%, rgba(9,18,25,0.95) 100%), #142838",
    likes: 42,
    caption: "High tempo rush through the neutral zone right after puck drop.",
    taggedPlayer: "Marcus Johansson (#11)",
  },
  {
    id: "clip-2",
    title: "Top Shelf Powerplay Snipe",
    team: "Northline HC",
    timeAgo: "2h ago",
    durationSeconds: 18,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnailBg: "linear-gradient(180deg, rgba(9,18,25,0.2) 0%, rgba(9,18,25,0.95) 100%), #183325",
    likes: 89,
    caption: "Bar-down wrist shot on the 5-on-4 powerplay to open the scoring.",
    taggedPlayer: "Nathan MacKinnon (#29)",
  },
  {
    id: "clip-3",
    title: "Breakaway Glove Save",
    team: "Harbour Wolves",
    timeAgo: "3h ago",
    durationSeconds: 12,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    thumbnailBg: "linear-gradient(180deg, rgba(9,18,25,0.2) 0%, rgba(9,18,25,0.95) 100%), #1a233a",
    likes: 64,
    caption: "Spectacular windmill glove stop on the clean 1-on-0 breakaway.",
    taggedPlayer: "David Miller (#31)",
  },
  {
    id: "clip-4",
    title: "Overtime Game-Winning Celebration",
    team: "Northline HC",
    timeAgo: "4h ago",
    durationSeconds: 22,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    thumbnailBg: "linear-gradient(180deg, rgba(9,18,25,0.2) 0%, rgba(9,18,25,0.95) 100%), #261f38",
    likes: 112,
    caption: "Sudden death OT winner triggers the home bench celebration!",
    taggedPlayer: "Cale Makar (#8)",
  },
];

export function TheScoreClipsCarousel({ customClips }: { customClips?: ClipItem[] }) {
  const clips = customClips && customClips.length > 0 ? customClips : DEFAULT_CLIPS;
  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});

  const currentReel = activeReelIndex !== null ? clips[activeReelIndex] : null;

  const handleLike = (id: string, initial: number) => {
    setLikesMap((prev) => ({
      ...prev,
      [id]: (prev[id] ?? initial) + 1,
    }));
  };

  const nextReel = () => {
    if (activeReelIndex !== null && activeReelIndex < clips.length - 1) {
      setActiveReelIndex(activeReelIndex + 1);
    }
  };

  const prevReel = () => {
    if (activeReelIndex !== null && activeReelIndex > 0) {
      setActiveReelIndex(activeReelIndex - 1);
    }
  };

  return (
    <section style={{ marginBottom: "24px" }}>
      {/* theScore Clips Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, color: "var(--text)" }}>
          Clips
        </h2>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          Tap clip to watch story reel ({clips.length})
        </span>
      </div>

      {/* Horizontal Clips Carousel */}
      <div
        style={{
          display: "flex",
          gap: "14px",
          overflowX: "auto",
          paddingBottom: "8px",
          scrollbarWidth: "thin",
        }}
      >
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            onClick={() => setActiveReelIndex(index)}
            style={{
              minWidth: "155px",
              maxWidth: "155px",
              height: "240px",
              borderRadius: "14px",
              background: clip.thumbnailBg,
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "14px 12px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              flexShrink: 0,
              boxShadow: "0 6px 14px rgba(0,0,0,0.3)",
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = "var(--lime)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            {/* Top Team Badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  background: "rgba(0,0,0,0.6)",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  color: "var(--lime)",
                  letterSpacing: "0.5px",
                }}
              >
                {clip.team}
              </span>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)" }}>
                {clip.durationSeconds}s
              </span>
            </div>

            {/* theScore Signature Centered White Circle Play Button */}
            <div
              style={{
                alignSelf: "center",
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.4)",
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "8px solid transparent",
                  borderBottom: "8px solid transparent",
                  borderLeft: "14px solid #000000",
                  marginLeft: "3px",
                }}
              />
            </div>

            {/* Bottom Title & Subtitle */}
            <div>
              <p
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: "1.3",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {clip.title}
              </p>
              <span style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.6)", display: "block" }}>
                {clip.timeAgo}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Full-Screen Vertical Story Reel Modal */}
      {currentReel && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setActiveReelIndex(null)}
        >
          {/* Reel Content Box */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "380px",
              height: "90vh",
              maxHeight: "680px",
              background: "#000000",
              borderRadius: "20px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Reel Video Player */}
            <video
              src={currentReel.videoUrl}
              autoPlay
              controls
              playsInline
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />

            {/* Top Navigation & Info Overlay */}
            <div
              style={{
                position: "relative",
                zIndex: 2,
                padding: "16px",
                background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)",
              }}
            >
              {/* Story Progress Bar */}
              <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
                {clips.map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      height: "3px",
                      flex: 1,
                      borderRadius: "2px",
                      background: idx === activeReelIndex ? "var(--lime)" : "rgba(255,255,255,0.3)",
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "var(--lime)",
                      textTransform: "uppercase",
                    }}
                  >
                    {currentReel.team}
                  </span>
                  <h3 style={{ margin: "2px 0 0", fontSize: "14px", color: "#fff", fontWeight: 700 }}>
                    {currentReel.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveReelIndex(null)}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    color: "#fff",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    cursor: "pointer",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Close story reel"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Bottom Caption, Tags, & Like Action Overlay */}
            <div
              style={{
                position: "relative",
                zIndex: 2,
                padding: "16px 20px",
                background: "linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {currentReel.taggedPlayer && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--lime)", background: "rgba(199,244,80,0.15)", padding: "2px 8px", borderRadius: "4px", fontWeight: 700 }}>
                    ⭐ {currentReel.taggedPlayer}
                  </span>
                </div>
              )}

              <p style={{ margin: 0, fontSize: "13px", color: "#f1f5f9", lineHeight: "1.4" }}>
                {currentReel.caption}
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => handleLike(currentReel.id, currentReel.likes)}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    color: "#fff",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>❤️</span>
                  <span>{likesMap[currentReel.id] ?? currentReel.likes}</span>
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  {activeReelIndex !== null && activeReelIndex > 0 && (
                    <button
                      type="button"
                      onClick={prevReel}
                      style={{
                        background: "rgba(255,255,255,0.2)",
                        border: "none",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      ‹ Prev
                    </button>
                  )}
                  {activeReelIndex !== null && activeReelIndex < clips.length - 1 && (
                    <button
                      type="button"
                      onClick={nextReel}
                      style={{
                        background: "var(--lime)",
                        border: "none",
                        color: "#000",
                        fontWeight: 800,
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Next ›
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
