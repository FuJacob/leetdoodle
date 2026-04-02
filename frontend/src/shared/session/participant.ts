export interface SessionParticipant {
  userId: string;
  displayName: string;
}

const PARTICIPANT_STORAGE_KEY = "leetdoodle.participant";
const LEGACY_USER_ID_STORAGE_KEY = "userId";
const MAX_DISPLAY_NAME_LENGTH = 24;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CUTE_ANIMAL_NAMES = [
  "Capybara",
  "Otter",
  "Panda",
  "Quokka",
  "Fennec",
  "Koala",
  "Red Panda",
  "Axolotl",
  "Seal",
  "Penguin",
  "Corgi",
  "Bunny",
  "Chinchilla",
  "Lemur",
  "Hedgehog",
  "Raccoon",
  "Hamster",
  "Meerkat",
  "Alpaca",
  "Duckling",
];

function randomDefaultDisplayName(): string {
  const index = Math.floor(Math.random() * CUTE_ANIMAL_NAMES.length);
  return CUTE_ANIMAL_NAMES[index] ?? "Capybara";
}

export function normalizeDisplayName(
  raw: string | null | undefined,
  fallback?: string,
): string {
  const safe = (raw ?? "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);

  if (safe.length > 0) return safe;
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  }
  return randomDefaultDisplayName();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStoredParticipant(): SessionParticipant | null {
  try {
    const raw = sessionStorage.getItem(PARTICIPANT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return null;

    const userId = typeof parsed.userId === "string" ? parsed.userId.trim() : "";
    if (!UUID_REGEX.test(userId)) return null;

    const displayName = normalizeDisplayName(
      typeof parsed.displayName === "string" ? parsed.displayName : "",
      undefined,
    );

    return { userId, displayName };
  } catch {
    return null;
  }
}

function readLegacyUserId(): string | null {
  try {
    const raw = sessionStorage.getItem(LEGACY_USER_ID_STORAGE_KEY);
    if (!raw) return null;
    const value = raw.trim();
    return UUID_REGEX.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeParticipant(participant: SessionParticipant) {
  const normalized: SessionParticipant = {
    userId: participant.userId.trim(),
    displayName: normalizeDisplayName(participant.displayName),
  };

  sessionStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify(normalized));
  // Maintain existing key for compatibility with any stale codepaths.
  sessionStorage.setItem(LEGACY_USER_ID_STORAGE_KEY, normalized.userId);
}

export function getSessionParticipant(): SessionParticipant | null {
  const participant = readStoredParticipant();
  if (participant) return participant;

  const legacyUserId = readLegacyUserId();
  if (!legacyUserId) return null;

  const migrated: SessionParticipant = {
    userId: legacyUserId,
    displayName: randomDefaultDisplayName(),
  };
  writeParticipant(migrated);
  return migrated;
}

export function ensureSessionParticipant(): SessionParticipant {
  const existing = getSessionParticipant();
  if (existing) return existing;

  const created: SessionParticipant = {
    userId: crypto.randomUUID(),
    displayName: randomDefaultDisplayName(),
  };
  writeParticipant(created);
  return created;
}

export function saveSessionParticipant(participant: SessionParticipant): SessionParticipant {
  const normalized: SessionParticipant = {
    userId: participant.userId.trim(),
    displayName: normalizeDisplayName(participant.displayName),
  };
  writeParticipant(normalized);
  return normalized;
}

export function isCanvasPin(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}
