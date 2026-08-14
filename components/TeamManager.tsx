"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLabels, useCanManage } from "@/lib/labels/LabelProvider";
import { createClient } from "@/lib/supabase/client";
import { logActivity, logSecurityAudit } from "@/lib/data/activity-log";

export interface MemberRow {
  id: string;
  full_name: string | null;
  role: "owner" | "manager" | "member";
}

export interface InviteRow {
  email: string;
  role: "manager" | "member";
}

export function TeamManager({
  organizationId,
  ownerName,
  members,
  pendingInvites,
  appOrigin,
  currentUserId,
}: {
  organizationId: string;
  ownerName: string;
  members: MemberRow[];
  pendingInvites: InviteRow[];
  appOrigin: string;
  currentUserId: string;
}) {
  const labels = useLabels();
  const canManage = useCanManage();
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "member">("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ email: string; emailSent: boolean } | null>(null);

  const whatsappMessage = lastResult
    ? `Halo, kamu diundang bergabung ke ${ownerName || "organisasi RANGKUL"} di RANGKUL sebagai ${
        role === "manager" ? labels.managerRole : labels.memberRole
      }. Login dengan Google menggunakan email ${lastResult.email}: ${appOrigin}/login?email=${encodeURIComponent(
        lastResult.email
      )}`
    : "";

  const whatsappHref = whatsappMessage
    ? `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
    : "";

  async function handleInvite() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    setLastResult(null);

    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed, role }),
    });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body?.error ?? "Gagal mengundang. Coba lagi.");
      return;
    }

    setLastResult({ email: trimmed, emailSent: Boolean(body?.emailSent) });
    setEmail("");
    const { data: auth } = await supabase.auth.getUser();
    const actorName =
      (auth?.user?.user_metadata?.full_name as string | undefined) ??
      auth?.user?.email?.split("@")[0] ??
      "Seseorang";
    logActivity(supabase, {
      organizationId,
      actorId: currentUserId,
      actorName,
      action: "member.invited",
      targetType: "member",
      targetId: null,
      targetLabel: trimmed,
      detail: `role ${role}`,
    });
    logSecurityAudit({
      organizationId,
      actorId: currentUserId,
      actorName,
      action: "member.invited",
      targetType: "member",
      targetId: null,
      targetLabel: trimmed,
      detail: `role ${role}`,
    });
    router.refresh();
  }

  const roleLabel = (r: MemberRow["role"] | InviteRow["role"]) =>
    r === "owner" ? labels.ownerRole : r === "manager" ? labels.managerRole : labels.memberRole;

  return (
    <main className="flex-1 p-6 md:p-8 min-w-0 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Anggota Tim</h1>
      <p className="text-sm text-inkMuted mb-8">
        {canManage
          ? `Undang ${labels.memberRole.toLowerCase()} atau ${labels.managerRole.toLowerCase()} lain untuk bergabung ke ${
              ownerName ? `organisasi ${ownerName}` : "organisasi ini"
            }.`
          : `Daftar anggota di ${ownerName ? `organisasi ${ownerName}` : "organisasi ini"}.`}
      </p>

      {/* Form undang — hanya untuk Owner/Manager */}
      {canManage && (
        <div className="bg-surface border border-border rounded-card p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3">Undang Anggota Baru</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="flex-1 min-w-[200px] border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "manager" | "member")}
              className="border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink bg-surface"
            >
              <option value="member">{labels.memberRole}</option>
              <option value="manager">{labels.managerRole}</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={!email.trim() || saving}
              className="text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 transition"
              style={{ backgroundColor: labels.accent }}
            >
              {saving ? "Mengundang…" : "Undang"}
            </button>
          </div>
          {error && <p className="text-xs text-[#8A3E24] mt-2">{error}</p>}
          {lastResult && (
            <>
              <p
                className="text-xs mt-2 font-medium"
                style={{ color: lastResult.emailSent ? "#2F9E7A" : "#B8862F" }}
              >
                {lastResult.emailSent
                  ? `✓ Email undangan terkirim ke ${lastResult.email}.`
                  : `Undangan tersimpan, tapi email otomatis belum aktif — kabari ${lastResult.email} secara manual untuk login di ${appOrigin} memakai email ini.`}
              </p>
              <div className="flex gap-2 flex-wrap mt-3">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#25D366" }}
                >
                  <span aria-hidden="true">💬</span> Kirim via WhatsApp
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(whatsappMessage);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border border-border bg-surface hover:bg-surfaceMuted"
                >
                  Salin Pesan
                </button>
              </div>
            </>
          )}
          <p className="text-xs text-inkMuted mt-3">
            {lastResult
              ? "Setelah orang tsb login Google memakai email yang sama, mereka otomatis bergabung."
              : "Email undangan dikirim otomatis lewat Resend jika sudah dikonfigurasi (lihat README) — kalau belum, kamu perlu kabari orangnya secara manual."}
          </p>
        </div>
      )}

      {/* Anggota aktif */}
      <div className="bg-surface border border-border rounded-card overflow-hidden mb-6">
        <h2 className="text-sm font-semibold px-5 pt-4 pb-2">Anggota Aktif ({members.length})</h2>
        {members.map((m, idx) => (
          <div
            key={m.id}
            className={`flex items-center justify-between px-5 py-3 ${
              idx !== members.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="text-sm font-medium">{m.full_name ?? "Tanpa nama"}</span>
            <div className="flex items-center gap-2">
              {m.id !== currentUserId && (
                <Link
                  href={`/dashboard/chat?with=${m.id}`}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: labels.accent }}
                >
                  💬 Chat
                </Link>
              )}
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: labels.accentSoft, color: labels.accent }}
              >
                {roleLabel(m.role)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Undangan tertunda — hanya terlihat oleh Owner/Manager */}
      {canManage && pendingInvites.length > 0 && (
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <h2 className="text-sm font-semibold px-5 pt-4 pb-2">Menunggu Bergabung ({pendingInvites.length})</h2>
          {pendingInvites.map((inv, idx) => (
            <div
              key={inv.email}
              className={`flex items-center justify-between px-5 py-3 ${
                idx !== pendingInvites.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-sm">{inv.email}</span>
              <span className="text-xs text-inkMuted">{roleLabel(inv.role)} · belum bergabung</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
