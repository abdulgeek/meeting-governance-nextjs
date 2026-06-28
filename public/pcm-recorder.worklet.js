// AudioWorklet mic capture — runs OFF the main thread (replaces the deprecated
// ScriptProcessorNode, which processed audio on the main thread and caused UI jank/INP).
// Downsamples the mic to 16 kHz mono Int16 and posts it to the page only while recording
// (toggled via port.postMessage({recording})). Logic mirrors the old downsample + f2i.
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.recording === "boolean") this.recording = e.data.recording;
    };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (this.recording && ch && ch.length) {
      const ratio = sampleRate / 16000; // sampleRate is a global in the worklet scope
      const n = ratio > 1 ? Math.floor(ch.length / ratio) : ch.length;
      const out = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        const s = Math.max(-1, Math.min(1, ch[ratio > 1 ? Math.floor(i * ratio) : i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(out.buffer, [out.buffer]);
    }
    return true; // keep the processor alive
  }
}
registerProcessor("pcm-recorder", PcmRecorder);
