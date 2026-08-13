"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCurrentUserId } from "@/lib/labels/LabelProvider";
import { TeamOption } from "@/lib/data/teams";
import { MemberOption } from "@/lib/data/members";
import { logActivity } from "@/lib/data/activity-log";

export function TeamsManager({
  organizationId,
  teams,
  orgMembers = [],
  teamMembersMap = {},
}: {
  organizationId: string;
  teams: TeamOption[];
  orgMembers?: MemberOption[];
  teamMembersMap?: Record<string, string[]>;
}) {
  const labels = useLabels();
  const currentUserId = useCurrentUserId();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data: inserted, error: insertError } = await client
      .from("teams")
      .insert([{ organization_id: organizationId, name: trimmed }])
      .select("id")
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    logActivity(supabase, {
      organizationId,
      actorId: currentUserId,
      actorName: (u?.user_metadata?.full_name as string | undefined) ?? u?.email?.split("@")[0] ?? "Seseorang",
      action: "team.created",
      targetType: "team",
      targetId: (inserted as { id: string } | null)?.id ?? null,
      targetLabel: trimmed,
    });

    setName("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        `Hapus ${labels.teamLabel} ini? Tugas yang sudah terkait tetap ada, tapi tidak lagi terhubung ke ${labels.teamLabel.toLowerCase()} ini.`
      )
    )
      return;
    const deletedTeam = teams.find((t) => t.id === id);
    await supabase.from("teams").delete().eq("id", id);

    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    logActivity(supabase, {
      organizationId,
      actorId: currentUserId,
      actorName: (u?.user_metadata?.full_name as string | undefined) ?? u?.email?.split("@")[0] ?? "Seseorang",
      action: "team.deleted",
      targetType: "team",
      targetId: null,
      targetLabel: deletedTeam?.name ?? null,
    });

    router.refresh();
  }

  async function handleToggleMembership(teamId: string, userId: string, isMember: boolean) {
    setTogglingMemberId(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;

    if (isMember) {
      await client.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
    } else {
      await client
        .from("team_members")
        .insert([{ organization_id: organizationId, team_id: teamId, user_id: userId }]);
    }

    setTogglingMemberId(null);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-border rounded-card p-5 mb-6">
      <h2 className="text-sm font-semibold mb-1">{labels.teamLabelPlural}</h2>
      <p className="text-xs text-inkMuted mb-4">
        Kelola daftar {labels.teamLabel.toLowerCase()} di organisasi kamu (mis. beberapa{" "}
        {labels.teamLabel.toLowerCase()} sekaligus). Tugas bisa dikaitkan ke salah satunya, dan papan kerja bisa
        difilter per {labels.teamLabel.toLowerCase()}.
      </p>

      {teams.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          {teams.map((t, idx) => {
            const memberIds = teamMembersMap[t.id] ?? [];
            const isExpanded = expandedTeamId === t.id;
            return (
              <div key={t.id} className={idx !== teams.length - 1 ? "border-b border-border" : ""}>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm font-medium">{t.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedTeamId(isExpanded ? null : t.id)}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: labels.accent }}
                    >
                      {isExpanded ? "Tutup" : `Kelola Anggota (${memberIds.length})`}
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-xs font-semibold text-[#8A3E24] hover:underline"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 bg-surfaceAlt/40">
                    <p className="text-[11px] text-inkMuted mb-2">
                      Hanya anggota yang dicentang bisa membaca & mengirim pesan di channel chat{" "}
                      {labels.teamLabel.toLowerCase()} ini. Owner/Manager organisasi selalu punya akses,
                      apapun status centangnya.
                    </p>
                    {orgMembers.length === 0 ? (
                      <p className="text-xs text-inkMuted">Belum ada anggota organisasi lain.</p>
                    ) : (
                      <div className="space-y-1">
                        {orgMembers.map((m) => {
                          const isMember = memberIds.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-surface cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isMember}
                                disabled={togglingMemberId === m.id}
                                onChange={() => handleToggleMembership(t.id, m.id, isMember)}
                                className="rounded border-border"
                              />
                              {m.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nama ${labels.teamLabel.toLowerCase()} baru, mis. ${
            labels.teamLabel === "Kelas" ? "Kelas 8B" : labels.teamLabel === "Poli" ? "Poli Anak" : "Tim Baru"
          }`}
          className="flex-1 min-w-[180px] border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim() || saving}
          className="text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 transition"
          style={{ backgroundColor: labels.accent }}
        >
          {saving ? "Menambah…" : `+ Tambah ${labels.teamLabel}`}
        </button>
      </div>
      {error && <p className="text-xs text-[#8A3E24] mt-2">{error}</p>}
    </div>
  );
}
