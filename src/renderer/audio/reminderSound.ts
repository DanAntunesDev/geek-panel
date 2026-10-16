import type { ReminderSoundId } from "../../shared/sounds.js";

interface Note {
  at: number;
  freq: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  // se houver, a frequência desliza até este valor
  to?: number;
}

// Silêncio antes do primeiro som: fone bluetooth costuma cortar o começo ao acordar.
const LEAD_IN = 0.3;

const arpeggio = (freqs: number[], step: number, dur: number, type: OscillatorType, gain: number): Note[] =>
  freqs.map((freq, index) => ({ at: index * step, freq, dur, type, gain }));

const PATTERNS: Record<ReminderSoundId, Note[]> = {
  pixel: [...arpeggio([659, 784, 988, 1319], 0.09, 0.1, "square", 0.35), ...arpeggio([659, 784, 988, 1319], 0.09, 0.14, "square", 0.35).map((n) => ({ ...n, at: n.at + 0.6 }))],
  bell: [
    { at: 0, freq: 880, dur: 1.3, type: "sine", gain: 0.7 },
    { at: 0, freq: 2217, dur: 0.6, type: "sine", gain: 0.25 },
    { at: 0.75, freq: 988, dur: 1.3, type: "sine", gain: 0.7 },
    { at: 0.75, freq: 2490, dur: 0.6, type: "sine", gain: 0.25 },
  ],
  chime: arpeggio([523, 659, 784, 1047], 0.18, 0.7, "triangle", 0.6),
  drop: [0, 0.45].map((at) => ({ at, freq: 1200, to: 300, dur: 0.28, type: "sine" as const, gain: 0.8 })),
  alert: [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((at, index) => ({ at, freq: index % 2 ? 988 : 740, dur: 0.15, type: "square" as const, gain: 0.3 })),
  soft: [
    { at: 0, freq: 523, dur: 0.9, type: "sine", gain: 0.7 },
    { at: 0.25, freq: 659, dur: 0.9, type: "sine", gain: 0.7 },
  ],
};

export interface Playback {
  // false quando a saída pedida não existe mais e o som foi para a padrão
  usedRequestedDevice: boolean;
}

// Toca o som na saída escolhida (vazio = padrão do sistema). Volume de 0 a 100.
export async function playReminderSound(id: ReminderSoundId, volume: number, deviceId = ""): Promise<Playback> {
  // setSinkId já existe no Chromium do Electron, mas os tipos do TypeScript ainda não o trazem
  const context = new AudioContext() as AudioContext & { setSinkId(id: string): Promise<void> };
  let usedRequestedDevice = true;
  if (deviceId) {
    usedRequestedDevice = await context.setSinkId(deviceId).then(
      () => true,
      () => false,
    );
  }
  await context.resume();

  const master = context.createGain();
  master.gain.value = Math.max(0, Math.min(100, volume)) / 100;
  master.connect(context.destination);

  const start = context.currentTime + LEAD_IN;
  let end = start;
  for (const note of PATTERNS[id]) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const from = start + note.at;
    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.freq, from);
    if (note.to) oscillator.frequency.exponentialRampToValueAtTime(note.to, from + note.dur);
    envelope.gain.setValueAtTime(0.0001, from);
    envelope.gain.linearRampToValueAtTime(note.gain, from + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, from + note.dur);
    oscillator.connect(envelope).connect(master);
    oscillator.start(from);
    oscillator.stop(from + note.dur + 0.05);
    end = Math.max(end, from + note.dur + 0.05);
  }
  setTimeout(() => void context.close(), (end - context.currentTime + 0.3) * 1000);
  return { usedRequestedDevice };
}

export interface OutputDevice {
  id: string;
  label: string;
}

// Saídas de áudio do computador, com nome (fone, caixa, HDMI...).
export async function listOutputDevices(): Promise<OutputDevice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audiooutput" && device.deviceId !== "default" && device.deviceId !== "communications")
    .map((device) => ({ id: device.deviceId, label: device.label || "Saída de áudio" }));
}
