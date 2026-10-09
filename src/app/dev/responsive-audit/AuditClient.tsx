"use client";
import { useEffect, useState } from "react";

const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1728];
const PUBLIC = ["/", "/login", "/signup", "/forgot-password", "/verify-email", "/contact", "/terms", "/privacy", "/checkout/callback", "/checkout/crypto/AUDIT-REF"];

type Finding = { route: string; width: number; kind: "overflow" | "two-submits" | "error"; detail: string };

function describe(el: Element): string {
  const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 4).join(".");
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}> "${text}"`;
}

function scrollsItself(el: Element, win: Window): boolean {
  for (let p = el.parentElement; p && p !== win.document.body; p = p.parentElement) {
    const ox = win.getComputedStyle(p).overflowX;
    if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true;
  }
  return false;
}

function audit(win: Window, route: string, width: number): Finding[] {
  const out: Finding[] = [];
  const vw = win.innerWidth;
  const seen = new Set<Element>();
  for (const el of Array.from(win.document.body.querySelectorAll("*"))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1) continue;
    if (win.getComputedStyle(el).position === "fixed" && r.left >= vw) continue; // off-canvas drawer
    if (scrollsItself(el, win)) continue;
    // Report the outermost offender only.
    if (el.parentElement && seen.has(el.parentElement)) { seen.add(el); continue; }
    seen.add(el);
    out.push({ route, width, kind: "overflow", detail: `${describe(el)} right=${Math.round(r.right)} > ${vw}` });
  }
  for (const form of Array.from(win.document.querySelectorAll("form"))) {
    const visible = Array.from(form.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]')).filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && win.getComputedStyle(b).visibility !== "hidden";
    });
    if (visible.length > 1) out.push({ route, width, kind: "two-submits", detail: `${describe(form)} has ${visible.length} visible submits` });
  }
  return out.slice(0, 8);
}

function load(route: string, width: number): Promise<Finding[]> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.style.cssText = `width:${width}px;height:900px;border:0;position:absolute;left:-99999px;top:0`;
    frame.src = route;
    const done = (f: Finding[]) => { frame.remove(); resolve(f); };
    const timeout = window.setTimeout(() => done([{ route, width, kind: "error", detail: "timed out" }]), 45_000);
    frame.onload = () => window.setTimeout(() => {
      window.clearTimeout(timeout);
      try { done(audit(frame.contentWindow!, route, width)); }
      catch (e) { done([{ route, width, kind: "error", detail: String(e) }]); }
    }, 2500);
    document.body.appendChild(frame);
  });
}

async function authedRoutes(): Promise<string[]> {
  const routes = ["/account", "/account/tickets"];
  try {
    const me = await fetch("/api/backend/auth/me");
    if (!me.ok) return [];
    routes.push("/host", "/host/payouts", "/host/earnings", "/host/payout-account", "/host/verify", "/host/events/new", "/door");
    const ev = await fetch("/api/backend/organizer/events?limit=1");
    if (ev.ok) {
      const body = await ev.json();
      const id = (body.data ?? body)?.events?.[0]?.id;
      if (id) for (const t of ["", "/attendees", "/members", "/revenue-sharing", "/team"]) routes.push(`/host/events/${id}${t}`);
      if (id) routes.push(`/door/${id}`);
    }
  } catch {}
  return routes;
}

/**
 * The responsive audit (#50). See `page.tsx` for what it checks and how to
 * run it.
 */
export function AuditClient() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [progress, setProgress] = useState("starting");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const widths = q.get("widths")?.split(",").map(Number) ?? WIDTHS;
      let event = "/events/lemonade-night";
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events?limit=1&startDate=${new Date().toISOString()}`);
        const b = await r.json();
        const slug = b?.data?.events?.[0]?.slug;
        if (slug) event = `/events/${slug}`;
      } catch {}
      const routes = q.get("routes")?.split(",") ?? [...PUBLIC, event, `${event}/checkout`, ...(await authedRoutes())];
      const all: Finding[] = [];
      for (const route of routes) {
        for (const w of widths) {
          if (!alive) return;
          setProgress(`${route} @ ${w}px`);
          all.push(...(await load(route, w)));
          setFindings([...all]);
        }
      }
      setProgress(`checked ${routes.length} routes × ${widths.length} widths`);
      setDone(true);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="p-6 font-mono text-label">
      <h1 className="text-title font-bold">Responsive audit (local only)</h1>
      <p id="audit-status">{done ? "DONE" : "RUNNING"}: {progress}</p>
      <p>{findings.length} finding(s)</p>
      <ul id="audit-findings" className="mt-4 flex flex-col gap-1">
        {findings.map((f, i) => (
          <li key={i} className={f.kind === "error" ? "text-warn" : "text-danger"}>
            [{f.kind}] {f.route} @ {f.width}px: {f.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
