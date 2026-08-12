/**
 * Chat Privat + Read-by + Mention
 * --------------------------------
 * "Diskusi Tim" (chat umum) dan chat privat (DM) sama-sama disimpan di
 * tabel `messages`. Bedanya cuma kolom `recipient_id`: NULL untuk Diskusi
 * Tim, terisi untuk DM. `conversationKey` di bawah ini dipakai sebagai
 * kunci konsisten untuk kedua jenis percakapan, dipakai juga oleh tabel
 * `message_reads` untuk melacak status "sudah dibaca".
 */

export const TEAM_CONVERSATION_KEY = "team";

export function dmConversationKey(userIdA: string, userIdB: string): string {
  const [a, b] = [userIdA, userIdB].sort();
  return `dm:${a}:${b}`;
}

/**
 * Cari nama-nama anggota yang disebut lewat "@Nama" di sebuah pesan.
 * Cocok sederhana berbasis teks — tidak butuh skema tambahan, cukup
 * cocokkan terhadap daftar anggota yang sedang aktif di organisasi.
 */
export function findMentions(content: string, memberNames: string[]): string[] {
  const found: string[] = [];
  for (const name of memberNames) {
    if (content.includes(`@${name}`)) found.push(name);
  }
  return found;
}

/** Pecah teks pesan jadi segmen biasa & segmen "@mention" untuk rendering. */
export function splitMentionSegments(
  content: string,
  memberNames: string[]
): { text: string; isMention: boolean }[] {
  if (memberNames.length === 0) return [{ text: content, isMention: false }];

  // Urutkan nama terpanjang dulu supaya "@Ahmad Ridho" tidak kepotong jadi "@Ahmad".
  const sorted = [...memberNames].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`@(${sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");

  const segments: { text: string; isMention: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), isMention: false });
    }
    segments.push({ text: match[0], isMention: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), isMention: false });
  }
  return segments.length > 0 ? segments : [{ text: content, isMention: false }];
}
