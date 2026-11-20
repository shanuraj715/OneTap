/**
 * A short two-tone beep (no sound files). Browsers only allow sound after the person has touched the page once, so
 * `unlockSound()` is called from a tap; until then `beep()` quietly does nothing.
 */
let audio = null;

export function unlockSound() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") void audio.resume();
    return audio.state !== "closed";
  } catch {
    return false;
  }
}

/** "new" = a new order (rising), "ready" = something is ready for the waiter (a higher bell-like pair). */
export function beep(kind = "new") {
  if (!audio || audio.state !== "running") return;
  const notes = kind === "ready" ? [880, 1175] : [660, 880];
  const t0 = audio.currentTime;
  notes.forEach((hz, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.16);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.16 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.22);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + i * 0.16);
    osc.stop(t0 + i * 0.16 + 0.25);
  });
}
