"use client";

import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { Button } from "@/components/ui/button";

export type ShareReportProps = {
  /** month as saved by the calculator, e.g. "2026-10" */
  month: string;
  /** the calculator result (res) */
  result: {
    totalKgCO2e: number;
    breakdown: Record<string, number>;
    recommendations?: { action: string }[];
  };
  /** optional: public URL to share. Defaults to the site origin. */
  shareUrl?: string;
};

function prettyMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

export function ShareReport({ month: rawMonth, result, shareUrl }: ShareReportProps) {
  const month = prettyMonth(rawMonth);
  const totalKg = result.totalKgCO2e;
  const breakdown = Object.entries(result.breakdown).map(([key, kg]) => ({
    label: key.charAt(0).toUpperCase() + key.slice(1),
    kg,
  }));
  const topAction = result.recommendations?.[0]?.action;
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const url = () => shareUrl ?? window.location.origin;
  const text = `My carbon footprint for ${month}: ${fmt(totalKg)} kg CO₂e. Calculated with Ecometrics.`;

  const makeImage = async () => {
    if (!cardRef.current) return null;
    // pixelRatio 2 on a 540x675 card -> 1080x1350 (Instagram 4:5 portrait)
    return toBlob(cardRef.current, { pixelRatio: 2, cacheBust: true });
  };

  const fileName = `ecometrics-${month.replace(/\s+/g, "-").toLowerCase()}.png`;

  const download = async () => {
    const blob = await makeImage();
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Instagram has no web share URL. On phones the native share sheet lists
  // Instagram; on desktop we download the image so it can be uploaded.
  const shareNative = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const blob = await makeImage();
      if (!blob) return;
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: "My Ecometrics report" });
      } else {
        await download();
        setNotice("Image saved. Open Instagram and upload it from your device.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNotice("Couldn't share the image. Try Download.");
    } finally {
      setBusy(false);
    }
  };

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=640,height=600");
  const enc = encodeURIComponent;

  const links = [
    { name: "Facebook", href: () => `https://www.facebook.com/sharer/sharer.php?u=${enc(url())}` },
    { name: "X", href: () => `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url())}` },
    { name: "WhatsApp", href: () => `https://wa.me/?text=${enc(`${text} ${url()}`)}` },
    { name: "LinkedIn", href: () => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url())}` },
    { name: "Telegram", href: () => `https://t.me/share/url?url=${enc(url())}&text=${enc(text)}` },
  ];

  const copy = async () => {
    await navigator.clipboard.writeText(`${text} ${url()}`);
    setNotice("Copied to clipboard.");
  };

  const max = Math.max(...breakdown.map((b) => b.kg), 1);

  return (
    <section className="space-y-4">
      {/* The card is rendered with inline styles so the exported PNG looks the
          same regardless of dark mode or CSS variables. */}
      <div className="overflow-x-auto">
        <div
          ref={cardRef}
          style={{
            width: 540,
            height: 675,
            padding: 48,
            background: "#0f1f17",
            color: "#eaf3ec",
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 18, color: "#8fd3a4", fontWeight: 600 }}>Ecometrics</div>
            <div style={{ fontSize: 16, opacity: 0.7, marginTop: 4 }}>{month}</div>
          </div>

          <div>
            <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1 }}>{fmt(totalKg)}</div>
            <div style={{ fontSize: 20, opacity: 0.8, marginTop: 8 }}>kg CO₂e this month</div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {breakdown.map((b) => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                  <span>{b.label}</span>
                  <span>{fmt(b.kg)} kg</span>
                </div>
                <div style={{ height: 8, background: "#1d3a2a", borderRadius: 4, marginTop: 4 }}>
                  <div
                    style={{
                      width: `${(b.kg / max) * 100}%`,
                      height: "100%",
                      background: "#8fd3a4",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {topAction && (
            <div style={{ fontSize: 15, opacity: 0.85, borderTop: "1px solid #2a4a38", paddingTop: 16 }}>
              Next step: {topAction}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={shareNative} disabled={busy}>
          {busy ? "Preparing…" : "Instagram / more"}
        </Button>
        {links.map((l) => (
          <Button key={l.name} variant="outline" onClick={() => open(l.href())}>
            {l.name}
          </Button>
        ))}
        <Button variant="outline" onClick={download}>Download image</Button>
        <Button variant="outline" onClick={copy}>Copy text</Button>
      </div>

      {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
    </section>
  );
}
