const MEDIA_OMITTED = new Set([
  "<media omitted>",
  "image omitted",
  "video omitted",
  "audio omitted",
  "sticker omitted",
  "gif omitted",
  "<attached: media omitted>"
]);

const LINE_PATTERNS = [
  // Android / common export: 03/10/2026, 14:32 - Name: message
  /^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\s+-\s+(.*)$/i,
  // iOS export: [03/10/2026, 14:32:01] Name: message
  /^\[(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\]\s+(.*)$/,
  // Alternate exports: 03/10/2026, 14:32 - message
  /^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\s+-\s+(.*)$/i
];

function parseHeader(line) {
  for (const pattern of LINE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const [, date, time, rest] = match;
      const colon = rest.indexOf(": ");
      if (colon >= 0) {
        return {
          date,
          time,
          author: rest.slice(0, colon).trim(),
          text: rest.slice(colon + 2)
        };
      }
      return { date, time, author: null, text: rest };
    }
  }
  return null;
}

function normalizeFileName(name) {
  return name.replace(/^.*[\\/]/, "").trim().toLowerCase();
}

function isSystemMessage(author, text) {
  if (author) return false;
  return /messages and calls are end-to-end encrypted|created this group|changed the subject|changed the group|added you|removed you|left|joined using this group's invite|security code changed|disappearing messages/i.test(text);
}

function classifyAttachment(fileName, text) {
  const clean = fileName || text || "";
  const ext = clean.split("?")[0].split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "m4v", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "m4a", "aac", "ogg", "opus", "wav", "amr"].includes(ext)) return "audio";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip"].includes(ext)) return "file";
  return "unknown";
}

function extractAttachment(text) {
  // Modern WhatsApp exports can contain: <attached: filename.ext>
  const attached = text.match(/<attached:\s*([^>]+)>/i);
  if (attached) return attached[1].trim();

  // Some exports put the media filename in the message itself.
  const filename = text.match(/(?:^|\s)((?:IMG|VID|AUD|PTT|DOC|STK|GIF)[-_][^<>\s]+\.[A-Za-z0-9]{2,5})(?:$|\s)/i);
  return filename?.[1] || null;
}

function parseDateTime(dateText, timeText) {
  const normalized = dateText.replace(/[.]/g, "/").replace(/-/g, "/");
  const parts = normalized.split("/").map(Number);
  let day, month, year;

  if (parts[0] > 31) {
    [year, month, day] = parts;
  } else if (parts[2] > 31) {
    [day, month, year] = parts;
  } else {
    // WhatsApp exports in many locales are day/month/year. Keep that default.
    [day, month, year] = parts;
  }

  if (year < 100) year += year < 50 ? 2000 : 1900;
  const tm = timeText.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!tm) return null;

  let hour = Number(tm[1]);
  const minute = Number(tm[2]);
  const second = Number(tm[3] || 0);
  const meridiem = tm[4]?.toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  const value = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function parseWhatsAppText(rawText) {
  const normalized = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const messages = [];
  let current = null;

  const commit = () => {
    if (!current) return;
    const text = current.text.trimEnd();
    const attachmentName = extractAttachment(text);
    const omitted = MEDIA_OMITTED.has(text.trim().toLowerCase());
    messages.push({
      id: messages.length,
      date: current.date,
      time: current.time,
      timestamp: parseDateTime(current.date, current.time),
      author: current.author,
      text,
      attachmentName,
      attachmentType: attachmentName ? classifyAttachment(attachmentName, text) : omitted ? "media" : null,
      isSystem: isSystemMessage(current.author, text)
    });
    current = null;
  };

  for (const line of lines) {
    const header = parseHeader(line);
    if (header) {
      commit();
      current = header;
    } else if (current) {
      current.text += "\n" + line;
    }
  }
  commit();

  const participants = [...new Set(messages.filter(m => m.author && !m.isSystem).map(m => m.author))];
  return { messages, participants };
}

export function buildMediaMap(files) {
  const map = new Map();
  for (const file of files) {
    map.set(normalizeFileName(file.name), file);
  }
  return map;
}

export function findMedia(mediaMap, attachmentName) {
  if (!attachmentName) return null;
  return mediaMap.get(normalizeFileName(attachmentName)) ||
    [...mediaMap.entries()].find(([name]) => name.endsWith(normalizeFileName(attachmentName)))?.[1] ||
    null;
}