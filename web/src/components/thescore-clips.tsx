"use client";

import { useState, useRef } from "react";

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

export function TheScoreClipsCarousel({
  gameId,
  homeTeam = "Home",
  awayTeam = "Away",
  customClips,
}: {
  gameId?: string;
  homeTeam?: string;
  awayTeam?: string;
  customClips?: ClipItem[];
}) {
  const storageKey = gameId ? `plaionn-reels-${gameId}` : "plaionn-reels";
  const [clips, setClips] = useState<ClipItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // Fallback
      }
    }
    return customClips && customClips.length > 0 ? customClips : [];
  });

  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Upload Form states
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTeam, setUploadTeam] = useState(homeTeam);
  const [uploadPlayer, setUploadPlayer] = useState("");
  const [uploadVideoUrl, setUploadVideoUrl] = useState("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
  const [uploadCaption, setUploadCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    if (!uploadTitle.trim()) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
    setUploadingFile(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: data,
      });
      const result = await res.json();
      if (res.ok && result.success && result.url) {
        setUploadVideoUrl(result.url);
      } else {
        alert(result.message || "Could not upload file to storage.");
        setUploadedFileName("");
      }
    } catch {
      alert("Failed to upload file to storage.");
      setUploadedFileName("");
    } finally {
      setUploadingFile(false);
    }
  };

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

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) return;

    const newClip: ClipItem = {
      id: `clip-${Date.now()}`,
      title: uploadTitle.trim(),
      team: uploadTeam.trim() || homeTeam,
      timeAgo: "Just now",
      durationSeconds: 15,
      videoUrl: uploadVideoUrl.trim(),
      thumbnailBg: "linear-gradient(180deg, rgba(16, 185, 129, 0.25) 0%, rgba(9, 18, 25, 0.95) 100%), #142838",
      likes: 1,
      caption: uploadCaption.trim() || "Uploaded game highlight reel.",
      taggedPlayer: uploadPlayer.trim() || undefined,
    };

    const updated = [newClip, ...clips];
    setClips(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    setIsUploadOpen(false);
    setUploadTitle("");
    setUploadCaption("");
    setActiveReelIndex(0); // Instantly open newly uploaded reel
  };

  return (
    <section style={{ marginBottom: "24px" }}>
      {/* theScore Clips Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, color: "var(--text)" }}>
            Game Reels &amp; Highlights
          </h2>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            Tap clip to watch story reel ({clips.length} active)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="button button-sm primary"
          style={{ fontSize: "12px", fontWeight: 700, padding: "6px 14px" }}
        >
          📹 + Upload Footage into Reel
        </button>
      </div>

      {/* Horizontal Clips Carousel or Clean Empty State */}
      {clips.length === 0 ? (
        <div
          style={{
            background: "rgba(17, 24, 39, 0.4)",
            border: "1px dashed var(--line)",
            borderRadius: "14px",
            padding: "32px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "28px" }}>🎬</div>
          <strong style={{ fontSize: "14px", color: "var(--text)" }}>
            No video reels uploaded for this match yet
          </strong>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)", maxWidth: "420px" }}>
            Upload raw scene footage or match highlight clips into the reel to showcase player plays to fans and scouts.
          </p>
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="button button-sm primary"
            style={{ marginTop: "6px", fontSize: "12px", fontWeight: 700 }}
          >
            📹 + Upload Footage into Reel
          </button>
        </div>
      ) : (
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
      )}

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
      {/* UPLOAD REEL MODAL */}
      {isUploadOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
          onClick={() => setIsUploadOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0d1b24",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", color: "var(--text)" }}>
                📹 Upload Game Footage into Reels
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Reel Title
                </label>
                <input
                  required
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Coast to Coast OT Winner"
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "var(--text)",
                    fontSize: "13.5px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                    Team
                  </label>
                  <input
                    type="text"
                    value={uploadTeam}
                    onChange={(e) => setUploadTeam(e.target.value)}
                    placeholder="e.g. Northline HC"
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                    Tagged Player
                  </label>
                  <input
                    type="text"
                    value={uploadPlayer}
                    onChange={(e) => setUploadPlayer(e.target.value)}
                    placeholder="e.g. Nathan MacKinnon (#29)"
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  Video Footage File (MP4, MOV, WEBM)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed " + (uploadedFileName ? "var(--lime)" : "rgba(255,255,255,0.2)"),
                    borderRadius: "10px",
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: uploadedFileName ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.04)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {uploadingFile ? (
                    <div style={{ color: "var(--lime)", fontWeight: 700, fontSize: "14px" }}>
                      ⏳ Uploading footage to Supabase storage…
                    </div>
                  ) : uploadedFileName ? (
                    <div>
                      <span style={{ fontSize: "24px", display: "block", marginBottom: "4px" }}>✅</span>
                      <strong style={{ color: "var(--lime)", fontSize: "14px", display: "block" }}>
                        Video Uploaded: {uploadedFileName}
                      </strong>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Click to browse and choose a different video</span>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>📤</span>
                      <strong style={{ fontSize: "14.5px", color: "var(--text)", display: "block", marginBottom: "4px" }}>
                        Click to Browse &amp; Upload Video File
                      </strong>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                        Uploads directly to Supabase storage (MP4, MOV, WEBM)
                      </span>
                    </div>
                  )}
                </div>

                {/* Optional Web Link Accordion */}
                <div style={{ marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowUrlFallback(!showUrlFallback)}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "11.5px", cursor: "pointer", padding: 0 }}
                  >
                    {showUrlFallback ? "▲ Hide web URL link" : "▼ Or enter a direct web video link / sample clip"}
                  </button>
                  {showUrlFallback && (
                    <div style={{ marginTop: "8px" }}>
                      <input
                        type="url"
                        value={uploadVideoUrl}
                        onChange={(e) => setUploadVideoUrl(e.target.value)}
                        placeholder="https://.../video.mp4"
                        style={{
                          width: "100%",
                          background: "#13232e",
                          border: "1px solid var(--line)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "var(--text)",
                          fontSize: "13px",
                        }}
                      />
                      <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>Sample clips:</span>
                        <button
                          type="button"
                          onClick={() => { setUploadVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"); setUploadedFileName("Sample-Rush.mp4"); }}
                          style={{ fontSize: "10px", background: "rgba(255,255,255,0.08)", border: "none", color: "var(--accent)", padding: "2px 6px", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Rush
                        </button>
                        <button
                          type="button"
                          onClick={() => { setUploadVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"); setUploadedFileName("Sample-Snipe.mp4"); }}
                          style={{ fontSize: "10px", background: "rgba(255,255,255,0.08)", border: "none", color: "var(--accent)", padding: "2px 6px", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Snipe
                        </button>
                        <button
                          type="button"
                          onClick={() => { setUploadVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"); setUploadedFileName("Sample-GloveSave.mp4"); }}
                          style={{ fontSize: "10px", background: "rgba(255,255,255,0.08)", border: "none", color: "var(--accent)", padding: "2px 6px", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Glove Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Reel Caption
                </label>
                <textarea
                  rows={2}
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Describe the play or sequence..."
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "var(--text)",
                    fontSize: "13px",
                    resize: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="button"
                  style={{ fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary"
                  style={{ fontSize: "13px", fontWeight: 700 }}
                >
                  Publish to Game Reels
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
