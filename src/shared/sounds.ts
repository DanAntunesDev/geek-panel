// Sons do lembrete da agenda. Cada um é sintetizado no app (veja renderer/audio/reminderSound.ts).

export const REMINDER_SOUNDS = [
  { id: "pixel", label: "Pixel (8 bits)" },
  { id: "bell", label: "Sino" },
  { id: "chime", label: "Carrilhão" },
  { id: "drop", label: "Gota" },
  { id: "alert", label: "Alerta" },
  { id: "soft", label: "Suave" },
] as const;

export type ReminderSoundId = (typeof REMINDER_SOUNDS)[number]["id"];

export const isReminderSound = (value: unknown): value is ReminderSoundId => REMINDER_SOUNDS.some((sound) => sound.id === value);
