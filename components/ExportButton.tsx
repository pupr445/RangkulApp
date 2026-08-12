"use client";

function toCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ExportButton({
  rows,
  filename,
  label = "Ekspor CSV",
}: {
  rows: Record<string, string>[];
  filename: string;
  label?: string;
}) {
  function handleExport() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.map(toCsvValue).join(","),
      ...rows.map((row) => headers.map((h) => toCsvValue(row[h] ?? "")).join(",")),
    ];
    // \uFEFF (BOM) supaya Excel membaca karakter Indonesia (é, ñ, dst) dengan benar
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={rows.length === 0}
      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-inkMuted hover:bg-surfaceAlt disabled:opacity-40 transition"
    >
      ⬇ {label}
    </button>
  );
}
