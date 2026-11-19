/**
 * Fichier iCalendar (RFC 5545) d'un rendez-vous : heure de l'agence (fuseau Africa/Douala, UTC+1 sans heure d'été),
 * rappel une heure avant. Aucune donnée personnelle : seuls le service, le praticien et l'adresse de l'agence.
 */
export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
  /** Horodatage de création du fichier (DTSTAMP). */
  stamp?: Date;
  alarmMinutes?: number;
};

const TZ = "Africa/Douala";

/** Échappement des valeurs texte (virgule, point-virgule, barre oblique inverse, retour à la ligne). */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lignes repliées à 75 octets (continuation par une espace), comme l'exige la norme. */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** « 20261119T143000 » à l'heure de Douala. */
export function doualaStamp(date: Date): string {
  const local = new Date(date.getTime() + 60 * 60_000);
  return local.toISOString().replace(/[-:]/g, "").slice(0, 15);
}

/** « 20261119T133000Z » en temps universel. */
function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

export function buildIcs(event: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wintek//NextIn//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    `TZID:${TZ}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0100",
    "TZNAME:WAT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(event.stamp ?? new Date())}`,
    `DTSTART;TZID=${TZ}:${doualaStamp(event.start)}`,
    `DTEND;TZID=${TZ}:${doualaStamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(event.summary)}`,
    `TRIGGER:-PT${event.alarmMinutes ?? 60}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
