"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/lib/labels/LabelProvider";
import { CustomFieldDef, CustomFieldType, slugifyFieldKey } from "@/lib/data/custom-fields";

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Teks",
  number: "Angka",
  date: "Tanggal",
};

export function CustomFieldsManager({
  organizationId,
  fields,
}: {
  organizationId: string;
  fields: CustomFieldDef[];
}) {
  const labels = useLabels();
  const router = useRouter();
  const supabase = createClient();

  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);

    const key = slugifyFieldKey(trimmed);
    if (!key) {
      setSaving(false);
      setError("Nama field tidak valid — coba pakai huruf/angka.");
      return;
    }
    if (fields.some((f) => f.field_key === key)) {
      setSaving(false);
      setError("Sudah ada field dengan nama serupa.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { error: insertError } = await client.from("custom_fields").insert([
      {
        organization_id: organizationId,
        entity: "task",
        field_key: key,
        field_label: trimmed,
        field_type: type,
      },
    ]);

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setLabel("");
    setType("text");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus field ini? Data yang sudah terisi di tugas lama tidak akan ikut terhapus, tapi tidak akan tampil lagi.")) return;
    await supabase.from("custom_fields").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-border rounded-card p-5 mb-6">
      <h2 className="text-sm font-semibold mb-1">Field Tambahan untuk {labels.taskLabel}</h2>
      <p className="text-xs text-inkMuted mb-4">
        Tambahkan kolom data sendiri yang relevan untuk {labels.sectorDisplayName.toLowerCase()} kamu — misalnya
        &quot;Nilai&quot;, &quot;Nama Pasien&quot;, atau apa pun. Field ini akan muncul otomatis di form{" "}
        {labels.taskLabel.toLowerCase()}.
      </p>

      {fields.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          {fields.map((f, idx) => (
            <div
              key={f.id}
              className={`flex items-center justify-between px-4 py-2.5 ${
                idx !== fields.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="text-sm">
                <span className="font-medium">{f.field_label}</span>{" "}
                <span className="text-xs text-inkMuted">({TYPE_LABEL[f.field_type]})</span>
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                className="text-xs font-semibold text-[#8A3E24] hover:underline"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nama field, mis. Nilai Ujian"
          className="flex-1 min-w-[180px] border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CustomFieldType)}
          className="border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ink bg-surface"
        >
          <option value="text">Teks</option>
          <option value="number">Angka</option>
          <option value="date">Tanggal</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={!label.trim() || saving}
          className="text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 transition"
          style={{ backgroundColor: labels.accent }}
        >
          {saving ? "Menambah…" : "+ Tambah Field"}
        </button>
      </div>
      {error && <p className="text-xs text-[#8A3E24] mt-2">{error}</p>}
    </div>
  );
}
