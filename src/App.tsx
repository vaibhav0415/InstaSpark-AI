import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
type ToneOption = "professional" | "playful" | "bold" | "minimal" | "luxury";
type PlatformOption = "instagram" | "linkedin";
type IdeaFormat =
  | "carousel"
  | "reel"
  | "single image"
  | "carousel (PDF)"
  | "text post + image"
  | "thought leadership";

type BrandProfile = {
  brandName: string;
  industry: string;
  tone: ToneOption;
  targetAudience: string;
  pastCaptions: string;
  platform: PlatformOption;
};

type ContentIdea = {
  caption: string;
  hook?: string;
  body?: string;
  cta?: string;
  format: IdeaFormat;
  postTime: string;
  viralityScore?: number;
  isFounderPost?: boolean;
};

type OptimalWindows = {
  primaryWindow: string;
  secondaryWindow: string;
  bestDays: string[];
  timezoneLogic: string;
  engagementStrategy: string;
};

type HashtagTiers = {
  niche: string[];
  mid: string[];
  broad: string[];
};

// ── Groq API via fetch ────────────────────────────────────────────────────────
async function callAI(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert social media content strategist. Always respond with valid JSON only. No markdown, no backticks, no explanation. Just raw JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || "Groq API error");
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

function parseJSON<T>(raw: string): T {
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(clean) as T;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [brandProfile, setBrandProfile] = useState<BrandProfile>({
    brandName: "",
    industry: "",
    tone: "professional",
    targetAudience: "",
    pastCaptions: "",
    platform: "instagram",
  });

  const [scanInput, setScanInput] = useState("");
  const [hashtagForm, setHashtagForm] = useState({ topic: "", nicheKeyword: "" });
  const [hashtags, setHashtags] = useState<HashtagTiers>({ niche: [], mid: [], broad: [] });
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [timing, setTiming] = useState<OptimalWindows | null>(null);
  const [activeTab, setActiveTab] = useState<"ideas" | "hashtags" | "timing">("ideas");

  const [scanLoading, setScanLoading] = useState(false);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [hashtagLoading, setHashtagLoading] = useState(false);

  const [scanError, setScanError] = useState("");
  const [ideasError, setIdeasError] = useState("");
  const [hashtagError, setHashtagError] = useState("");
  const [copyToast, setCopyToast] = useState("");

  const isInstagram = brandProfile.platform === "instagram";

  function showToast(msg: string) {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(""), 2000);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  }

  async function handleScanWebsite() {
    if (!scanInput.trim()) return;
    setScanLoading(true);
    setScanError("");
    try {
      const prompt = `Analyze this website URL or brand description and extract brand identity.
Return ONLY valid JSON with no markdown, no backticks, no explanation.

JSON shape:
{
  "brandName": "string",
  "industry": "string",
  "tone": "professional",
  "targetAudience": "string",
  "pastCaptions": "2-3 example captions in this brand voice"
}

tone must be exactly one of: professional, playful, bold, minimal, luxury

Input to analyze: ${scanInput}`;

      const raw = await callAI(prompt);
      const parsed = parseJSON<Omit<BrandProfile, "platform">>(raw);
      setBrandProfile((prev) => ({ ...parsed, platform: prev.platform }));
    } catch (e) {
      console.error(e);
      setScanError("Scan failed. Check your VITE_GROQ_API_KEY in .env and restart the server.");
    } finally {
      setScanLoading(false);
    }
  }

  async function generateIdeas() {
    if (!brandProfile.brandName || !brandProfile.industry || !brandProfile.targetAudience) {
      setIdeasError("Brand Name, Industry, and Target Audience are required.");
      return;
    }
    setIdeasLoading(true);
    setIdeasError("");
    try {
      const formats = isInstagram
        ? "carousel, reel, single image"
        : "carousel (PDF), text post + image, thought leadership";
      const persona = isInstagram ? "Instagram Content Director" : "LinkedIn & Executive Branding Director";
      const emojiRule = isInstagram
        ? "Use 2-4 emojis per caption."
        : "Use 0-2 emojis. Write structured insights or lists.";

      const prompt = `You are an expert ${persona}.
Return ONLY valid JSON. No markdown, no backticks, no explanation.

JSON shape:
{
  "ideas": [
    {
      "caption": "full caption text",
      "hook": "opening line to stop the scroll",
      "body": "main content body",
      "cta": "call to action",
      "format": "one of: ${formats}",
      "postTime": "e.g. Tuesday 7pm EST",
      "viralityScore": 85,
      "isFounderPost": false
    }
  ],
  "optimalWindows": {
    "primaryWindow": "e.g. Tuesday-Thursday 7-9pm EST",
    "secondaryWindow": "e.g. Saturday 10am-12pm EST",
    "bestDays": ["Tuesday", "Wednesday", "Thursday"],
    "timezoneLogic": "explanation of why these times work",
    "engagementStrategy": "2-3 sentence engagement strategy"
  }
}

Rules:
- Generate exactly 5 ideas
- Sort by viralityScore descending (100 = highest viral potential)
- viralityScore must be a number between 0 and 100
- isFounderPost is true if post should come from founder personally
- ${emojiRule}
- Platform: ${brandProfile.platform}

Brand context:
- Brand Name: ${brandProfile.brandName}
- Industry: ${brandProfile.industry}
- Tone: ${brandProfile.tone}
- Target Audience: ${brandProfile.targetAudience}
- Voice Reference: ${brandProfile.pastCaptions || "None provided"}`;

      const raw = await callAI(prompt);
      const parsed = parseJSON<{ ideas: ContentIdea[]; optimalWindows: OptimalWindows }>(raw);

      const normalized = parsed.ideas.map((idea) => ({
        ...idea,
        viralityScore: Math.min(100, Math.max(0, Number(idea.viralityScore) || 0)),
        isFounderPost: Boolean(idea.isFounderPost),
      }));

      setIdeas(normalized.sort((a, b) => (b.viralityScore ?? 0) - (a.viralityScore ?? 0)));
      setTiming(parsed.optimalWindows);
      setActiveTab("ideas");

      if (!hashtagForm.topic) {
        setHashtagForm((prev) => ({ ...prev, topic: brandProfile.industry }));
      }
    } catch (e) {
      console.error(e);
      setIdeasError("Generation failed. Please try again.");
    } finally {
      setIdeasLoading(false);
    }
  }

  async function generateHashtags(overrides?: { topic: string; nicheKeyword: string }) {
    const topic = overrides?.topic ?? hashtagForm.topic;
    const nicheKeyword = overrides?.nicheKeyword ?? hashtagForm.nicheKeyword;
    if (!topic) return;

    setHashtagLoading(true);
    setHashtagError("");
    try {
      const count = isInstagram ? "25-30" : "9-15";
      const focus = isInstagram ? "consumer brand discovery" : "B2B professional reach";

      const prompt = `You are a hashtag strategist for ${brandProfile.platform}.
Return ONLY valid JSON. No markdown, no backticks, no explanation.

JSON shape:
{
  "hashtags": {
    "niche": ["#tag1", "#tag2"],
    "mid": ["#tag1", "#tag2"],
    "broad": ["#tag1", "#tag2"]
  }
}

Rules:
- Generate ${count} total hashtags split across 3 tiers
- niche: low-competition branded or niche-specific tags
- mid: balanced reach and relevance tags
- broad: high-competition broad discovery tags
- Focus: ${focus}
- Every tag must start with #
- Topic: ${topic}
- Niche keyword: ${nicheKeyword || "none"}
- Platform: ${brandProfile.platform}`;

      const raw = await callAI(prompt);
      const parsed = parseJSON<{ hashtags: HashtagTiers }>(raw);
      setHashtags(parsed.hashtags);
      setActiveTab("hashtags");
    } catch (e) {
      console.error(e);
      setHashtagError("Hashtag generation failed. Please try again.");
    } finally {
      setHashtagLoading(false);
    }
  }

  function triggerHashtagsFromIdea(industry: string, brandName: string) {
    setHashtagForm({ topic: industry, nicheKeyword: brandName });
    generateHashtags({ topic: industry, nicheKeyword: brandName });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#e2e8f0",
    padding: "14px 16px",
    fontSize: 15,
    lineHeight: 1.4,
    borderRadius: 12,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2.2,
    display: "block",
    marginBottom: 8,
    textTransform: "uppercase",
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f5f5f0",
      backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.12) 0.75px, rgba(245,245,240,0) 0.75px)",
      backgroundSize: "24px 24px",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {copyToast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          backgroundColor: "#00ff88", color: "#000", padding: "10px 20px",
          fontWeight: 700, fontSize: 13, border: "2px solid #000",
          boxShadow: "3px 3px 0 #000", letterSpacing: 1,
        }}>
          {copyToast}
        </div>
      )}

      <header style={{
        position: "fixed",
        width: "100%",
        top: 0,
        left: 0,
        zIndex: 100,
        backgroundColor: "#FFE000",
        borderBottom: "3px solid #000",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, backgroundColor: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#FFE000", fontSize: 18, fontWeight: 900 }}>⚡</span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: 2, textTransform: "uppercase" }}>BrandSpark AI</div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#333", textTransform: "uppercase" }}>PROFESSIONAL CONTENT SUITE</div>
          </div>
        </div>
        <div style={{ border: "2px solid #000", padding: "4px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 2, display: "flex", alignItems: "center", gap: 6, backgroundColor: "#000" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#00cc66", display: "inline-block" }} />
          <span style={{ color: "#00ff88" }}>API CONNECTED</span>
        </div>
      </header>

      <div style={{ padding: "96px 32px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #334155", padding: "6px 14px", marginBottom: 20, fontSize: 11, fontWeight: 700, letterSpacing: 2, backgroundColor: "#0f172a", color: "#e2e8f0", borderRadius: 12 }}>
          ✦ CREATIVE BRUTALISM V1.0
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 52px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: -1, textTransform: "uppercase", color: "#000", marginBottom: 16 }}>
          GO VIRAL WITH SMARTER<br />SOCIAL MEDIA PLANNING
        </h1>
        <p style={{ fontSize: 15, color: "#172554", maxWidth: 520, lineHeight: 1.6, marginBottom: 40 }}>
          Keep your core brand identity safe in state. Generate professional multi-format content blueprints, target optimal audience timings, and sort highly contextual hashtag banks instantly.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Panel 0 */}
            <div style={{ backgroundColor: "#1a1a2e", border: "2px solid #000", padding: 24, boxShadow: "4px 4px 0 #000" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, backgroundColor: "#0f172a", border: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔍</div>
                <div>
                  <div style={{ color: "#FFE000", fontWeight: 800, fontSize: 13, letterSpacing: 2 }}>0. WEBSITE / ABOUT SCAN</div>
                  <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1 }}>PRE-POPULATES THE BRAND PROFILE</div>
                </div>
              </div>
              <label style={labelStyle}>WEBSITE URL OR BRAND DESCRIPTION</label>
              <textarea
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="e.g. 'A high-end organic coffee shop based in New York targeting remote workers.'"
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              {scanError && <p style={{ color: "#ff4466", fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{scanError}</p>}
              <button
                onClick={handleScanWebsite}
                disabled={scanLoading || !scanInput.trim()}
                style={{
                  marginTop: 12, width: "100%", backgroundColor: scanLoading ? "#333" : "#1a1a2e",
                  color: "#fff", border: "2px solid #444", padding: "12px 0",
                  fontSize: 12, fontWeight: 700, letterSpacing: 2,
                  cursor: scanLoading || !scanInput.trim() ? "not-allowed" : "pointer",
                  textTransform: "uppercase", opacity: !scanInput.trim() ? 0.5 : 1,
                }}
              >
                {scanLoading ? "⏳ SCANNING..." : "⚡ SCAN & AUTOCOMPLETE PROFILE"}
              </button>
            </div>

            {/* Panel 1 */}
            <div style={{ backgroundColor: "#1a1a2e", border: "2px solid #000", padding: 24, boxShadow: "4px 4px 0 #000" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, backgroundColor: "#ec489920", border: "1px solid #ec4899", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
                <div>
                  <div style={{ color: "#FFE000", fontWeight: 800, fontSize: 13, letterSpacing: 2 }}>1. BRAND PERSONA</div>
                  <div style={{ color: "#888", fontSize: 10, letterSpacing: 1 }}>STORES STATE BETWEEN GENERATORS</div>
                </div>
              </div>

              <label style={labelStyle}>SOCIAL MEDIA PLATFORM</label>
              <div style={{ display: "flex", marginBottom: 16, border: "1px solid #333" }}>
                {(["instagram", "linkedin"] as PlatformOption[]).map((p) => (
                  <button key={p} onClick={() => setBrandProfile((prev) => ({ ...prev, platform: p }))}
                    style={{
                      flex: 1, padding: "10px 0", fontSize: 11, fontWeight: 700,
                      letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", border: "none",
                      backgroundColor: brandProfile.platform === p ? (p === "instagram" ? "#ec4899" : "#0077b5") : "#0d0d1a",
                      color: brandProfile.platform === p ? "#fff" : "#666",
                    }}>
                    {p === "instagram" ? "📸 INSTAGRAM" : "💼 LINKEDIN"}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>BRAND NAME</label>
                  <input type="text" value={brandProfile.brandName} onChange={(e) => setBrandProfile((prev) => ({ ...prev, brandName: e.target.value }))} placeholder="e.g. ApexFit" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>INDUSTRY / NICHE</label>
                  <input type="text" value={brandProfile.industry} onChange={(e) => setBrandProfile((prev) => ({ ...prev, industry: e.target.value }))} placeholder="e.g. Activewear, SaaS" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>TONE / BRAND VOICE</label>
                  <select value={brandProfile.tone} onChange={(e) => setBrandProfile((prev) => ({ ...prev, tone: e.target.value as ToneOption }))} style={{ ...inputStyle, appearance: "auto" }}>
                    {(["professional", "playful", "bold", "minimal", "luxury"] as ToneOption[]).map((t) => (
                      <option key={t} value={t} style={{ backgroundColor: "#1a1a2e" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>TARGET AUDIENCE</label>
                  <input type="text" value={brandProfile.targetAudience} onChange={(e) => setBrandProfile((prev) => ({ ...prev, targetAudience: e.target.value }))} placeholder="e.g. Busy gym-goers" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>TONE REFERENCES</label>
                  {brandProfile.pastCaptions && (
                    <span style={{ fontSize: 10, backgroundColor: "#ec489930", color: "#ec4899", padding: "2px 8px", fontWeight: 700, letterSpacing: 1, border: "1px solid #ec4899" }}>VOICE MATCH ACTIVE</span>
                  )}
                </div>
                <textarea value={brandProfile.pastCaptions} onChange={(e) => setBrandProfile((prev) => ({ ...prev, pastCaptions: e.target.value }))} placeholder="Optional: Paste 1-2 examples of captions you love..." rows={3} style={{ ...inputStyle, resize: "vertical", marginTop: 6 }} />
              </div>

              {ideasError && <p style={{ color: "#ff4466", fontSize: 12, marginBottom: 8 }}>{ideasError}</p>}
              <button onClick={generateIdeas} disabled={ideasLoading}
                style={{ width: "100%", backgroundColor: ideasLoading ? "#c0398a" : "#ec4899", color: "#fff", border: "none", padding: "14px 0", fontSize: 13, fontWeight: 800, letterSpacing: 2, cursor: ideasLoading ? "wait" : "pointer", textTransform: "uppercase" }}>
                {ideasLoading ? "⏳ GENERATING IDEAS..." : "⚡ GENERATE 5 CONTENT IDEAS"}
              </button>
            </div>

            {/* Panel 2 */}
            <div style={{ backgroundColor: "#1a1a2e", border: "2px solid #000", padding: 24, boxShadow: "4px 4px 0 #000" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, backgroundColor: "#FFE00020", border: "1px solid #FFE000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#FFE000", fontSize: 16 }}>#</div>
                <div>
                  <div style={{ color: "#FFE000", fontWeight: 800, fontSize: 13, letterSpacing: 2 }}>2. HASHTAG MULTIPLIERS</div>
                  <div style={{ color: "#888", fontSize: 10, letterSpacing: 1 }}>GENERATE {isInstagram ? "25-30" : "9-15"} TAGGED MULTIPLIERS</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>TOPIC / CATEGORY</label>
                  <input type="text" value={hashtagForm.topic} onChange={(e) => setHashtagForm((prev) => ({ ...prev, topic: e.target.value }))} placeholder="e.g. fitness, minimal design" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>NICHE / BRAND KEY</label>
                  <input type="text" value={hashtagForm.nicheKeyword} onChange={(e) => setHashtagForm((prev) => ({ ...prev, nicheKeyword: e.target.value }))} placeholder="e.g. apex, run2026" style={inputStyle} />
                </div>
              </div>
              {hashtagError && <p style={{ color: "#ff4466", fontSize: 12, marginBottom: 8 }}>{hashtagError}</p>}
              <button onClick={() => generateHashtags()} disabled={hashtagLoading || !hashtagForm.topic}
                style={{ width: "100%", backgroundColor: hashtagLoading ? "#b8a000" : "#FFE000", color: "#000", border: "none", padding: "14px 0", fontSize: 13, fontWeight: 800, letterSpacing: 2, cursor: hashtagLoading || !hashtagForm.topic ? "not-allowed" : "pointer", textTransform: "uppercase", opacity: !hashtagForm.topic ? 0.6 : 1 }}>
                {hashtagLoading ? "⏳ GENERATING..." : "# GENERATE HASHTAGS"}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 18, boxShadow: "4px 4px 0 #000", minHeight: 600 }}>
            <div style={{ borderBottom: "2px solid #333", padding: "0 16px", display: "flex", alignItems: "center" }}>
              <div style={{ marginRight: 12, padding: "14px 0", minWidth: 80 }}>
                <div style={{ color: "#FFE000", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, lineHeight: 1.6 }}>⚡ LIVE DYNAMIC<br />WORKSPACE</div>
              </div>
              {(["ideas", "hashtags", "timing"] as const).map((tab) => {
                const labels = { ideas: "✦ CONTENT IDEAS", hashtags: "# HASHTAG BANK", timing: "⏰ BEST TIMES" };
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    style={{ padding: "16px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", border: "none", borderBottom: activeTab === tab ? "3px solid #ec4899" : "3px solid transparent", backgroundColor: activeTab === tab ? "#ec489918" : "transparent", color: activeTab === tab ? "#ec4899" : "#666", textTransform: "uppercase" }}>
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 24 }}>

              {activeTab === "ideas" && (
                ideas.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
                    <div style={{ fontSize: 48, opacity: 0.2 }}>💡</div>
                    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>No Content Generated Yet</div>
                    <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>Fill out your Brand Profile on the left and hit generate to construct high-engagement concepts instantly.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {ideas.map((idea, i) => (
                      <div key={i} style={{ backgroundColor: "#0d0d1a", border: "1px solid #2a2a4e", padding: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 8 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ backgroundColor: isInstagram ? "#ec489930" : "#0077b530", color: isInstagram ? "#ec4899" : "#0099dd", fontSize: 10, fontWeight: 700, padding: "3px 10px", border: `1px solid ${isInstagram ? "#ec4899" : "#0077b5"}`, letterSpacing: 1, textTransform: "uppercase" }}>{idea.format}</span>
                            {idea.isFounderPost && <span style={{ backgroundColor: "#FFE00020", color: "#FFE000", fontSize: 10, fontWeight: 700, padding: "3px 10px", border: "1px solid #FFE000", letterSpacing: 1 }}>FOUNDER POST</span>}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 9, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>Virality</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: (idea.viralityScore ?? 0) >= 80 ? "#00ff88" : (idea.viralityScore ?? 0) >= 60 ? "#FFE000" : "#ff6644" }}>{idea.viralityScore}</div>
                          </div>
                        </div>
                        {idea.hook && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 10, color: "#FFE000", fontWeight: 700, letterSpacing: 1 }}>HOOK — </span><span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{idea.hook}</span></div>}
                        {idea.body && <p style={{ color: "#bbb", fontSize: 12, lineHeight: 1.7, marginBottom: 8 }}>{idea.body}</p>}
                        {idea.cta && <div style={{ marginBottom: 12 }}><span style={{ fontSize: 10, color: "#ec4899", fontWeight: 700, letterSpacing: 1 }}>CTA — </span><span style={{ color: "#ddd", fontSize: 12 }}>{idea.cta}</span></div>}
                        <div style={{ borderTop: "1px solid #2a2a4e", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#888" }}>⏰ {idea.postTime}</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => triggerHashtagsFromIdea(brandProfile.industry, brandProfile.brandName)} style={{ fontSize: 10, color: "#FFE000", backgroundColor: "transparent", border: "1px solid #FFE00050", padding: "5px 10px", cursor: "pointer", fontWeight: 700, letterSpacing: 1 }}># MATCH HASHTAGS →</button>
                            <button onClick={() => copyText([idea.hook, idea.body, idea.cta, idea.caption].filter(Boolean).join("\n\n"))} style={{ fontSize: 10, color: "#fff", backgroundColor: "#2a2a4e", border: "1px solid #444", padding: "5px 10px", cursor: "pointer", fontWeight: 700, letterSpacing: 1 }}>COPY</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeTab === "hashtags" && (
                hashtags.niche.length === 0 && hashtags.mid.length === 0 && hashtags.broad.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
                    <div style={{ fontSize: 48, opacity: 0.2, fontWeight: 900, color: "#fff" }}>#</div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>No Hashtags Generated Yet</div>
                    <div style={{ color: "#0077cc", fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>Fill in the Hashtag Multipliers panel on the left and click generate.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {(["niche", "mid", "broad"] as const).map((tier) => {
                      const meta = { niche: { label: "NICHE / BRANDED", color: "#00ff88", desc: "Low competition · High relevance" }, mid: { label: "MID-TIER", color: "#FFE000", desc: "Balanced reach & relevance" }, broad: { label: "BROAD DISCOVERY", color: "#ec4899", desc: "High competition · Max exposure" } }[tier];
                      return (
                        <div key={tier} style={{ backgroundColor: "#0d0d1a", border: "1px solid #2a2a4e", padding: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div>
                              <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: 2 }}>{meta.label}</span>
                              <span style={{ fontSize: 10, color: "#666", marginLeft: 10 }}>{meta.desc}</span>
                            </div>
                            <button onClick={() => copyText(hashtags[tier].join(" "))} style={{ fontSize: 10, color: "#fff", backgroundColor: "#2a2a4e", border: "1px solid #444", padding: "4px 10px", cursor: "pointer", fontWeight: 700, letterSpacing: 1 }}>COPY ALL</button>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {hashtags[tier].map((tag, idx) => (
                              <span key={idx} onClick={() => copyText(tag)} title="Click to copy" style={{ backgroundColor: `${meta.color}15`, color: meta.color, fontSize: 12, padding: "4px 10px", border: `1px solid ${meta.color}40`, cursor: "pointer", fontWeight: 600 }}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => copyText([...hashtags.niche, ...hashtags.mid, ...hashtags.broad].join(" "))} style={{ width: "100%", backgroundColor: "#FFE000", color: "#000", border: "none", padding: "12px 0", fontSize: 12, fontWeight: 800, letterSpacing: 2, cursor: "pointer", textTransform: "uppercase" }}># COPY ALL HASHTAGS</button>
                  </div>
                )
              )}

              {activeTab === "timing" && (
                !timing ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
                    <div style={{ fontSize: 48, opacity: 0.2 }}>⏰</div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>No Timing Data Yet</div>
                    <div style={{ color: "#0077cc", fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>Generate content ideas first — timing data is included automatically.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ backgroundColor: "#0d0d1a", border: "1px solid #00ff8840", padding: 16 }}>
                        <div style={{ fontSize: 10, color: "#00ff88", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>PRIMARY WINDOW</div>
                        <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{timing.primaryWindow}</div>
                      </div>
                      <div style={{ backgroundColor: "#0d0d1a", border: "1px solid #FFE00040", padding: 16 }}>
                        <div style={{ fontSize: 10, color: "#FFE000", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>SECONDARY WINDOW</div>
                        <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{timing.secondaryWindow}</div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#0d0d1a", border: "1px solid #2a2a4e", padding: 16 }}>
                      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>BEST DAYS TO POST</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {timing.bestDays.map((day, i) => (
                          <span key={i} style={{ backgroundColor: "#ec489920", color: "#ec4899", fontSize: 12, padding: "5px 14px", border: "1px solid #ec489940", fontWeight: 700 }}>{day}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#0d0d1a", border: "1px solid #2a2a4e", padding: 16 }}>
                      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>TIMEZONE LOGIC</div>
                      <p style={{ color: "#bbb", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{timing.timezoneLogic}</p>
                    </div>
                    <div style={{ backgroundColor: "#0d0d1a", border: "1px solid #2a2a4e", padding: 16 }}>
                      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>ENGAGEMENT STRATEGY</div>
                      <p style={{ color: "#bbb", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{timing.engagementStrategy}</p>
                    </div>
                  </div>
                )
              )}

            </div>
          </div>
        </div>

        <div style={{ borderTop: "2px solid #000", marginTop: 48, paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#666" }}>© 2026 BrandSpark AI. CRAFTED FOR MAXIMUM SOCIAL MEDIA LEVERAGE.</span>
          <span style={{ fontSize: 11, color: "#0077cc" }}>⚡ Fully Responsive · Client-Side · Sandbox Ready</span>
        </div>
      </div>
    </div>
  );
}