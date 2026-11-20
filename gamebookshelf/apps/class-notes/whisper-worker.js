// Runs OpenAI's Whisper speech model in the browser (Transformers.js), off the main thread.
// Messages in:  {type:'load', model, multilingual}  {type:'transcribe', id, audio: Float32Array (16 kHz mono), language}
// Messages out: {type:'progress', file, loaded, total}  {type:'ready', device}  {type:'result', id, text}  {type:'error', id?, message}
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

env.allowLocalModels = false;
env.backends.onnx.logLevel = 'error';   // hide onnxruntime's harmless performance warnings

let asr = null, loadedModel = '', multilingual = false, loading = null;

async function hasGpu() {
  try { return !!(await navigator.gpu?.requestAdapter()); } catch { return false; }
}

async function load(model, isMulti) {
  if (asr && loadedModel === model) { postMessage({ type: 'ready', device: asr.__device }); return; }
  if (asr) { try { await asr.dispose(); } catch { /* ignore */ } asr = null; }
  const progress_callback = p => {
    if (p.status === 'progress' || p.status === 'done') postMessage({ type: 'progress', file: p.file, loaded: p.loaded ?? p.total ?? 1, total: p.total ?? 1 });
  };
  // Graphics chip first (several times faster). fp16 fails on some Intel GPUs, so use fp32 encoder + 4-bit decoder.
  const attempts = [{ device: 'wasm', dtype: 'q8' }];
  if (await hasGpu()) attempts.unshift({ device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } });
  let lastErr = null;
  for (const opt of attempts) {
    try {
      const p = await pipeline('automatic-speech-recognition', model, { ...opt, progress_callback, session_options: { logSeverityLevel: 3 } });
      // Warm up so the first real chunk isn't slow (compiles GPU shaders).
      await p(new Float32Array(16000), isMulti ? { language: 'en', task: 'transcribe' } : {});
      p.__device = opt.device;
      asr = p; loadedModel = model; multilingual = isMulti;
      postMessage({ type: 'ready', device: opt.device });
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Could not load the speech model.');
}

let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  if (data.type === 'load') {
    loading = load(data.model, !!data.multilingual).catch(e => { postMessage({ type: 'error', message: String(e?.message || e) }); });
    return;
  }
  if (data.type === 'transcribe') {
    queue = queue.then(async () => {
      try {
        await loading;
        if (!asr) throw new Error('The speech model is not loaded.');
        const opts = { chunk_length_s: 30, stride_length_s: 5 };
        if (multilingual) { opts.language = data.language || 'en'; opts.task = 'transcribe'; }
        const out = await asr(data.audio, opts);
        postMessage({ type: 'result', id: data.id, text: (Array.isArray(out) ? out[0]?.text : out?.text) || '' });
      } catch (e) {
        postMessage({ type: 'error', id: data.id, message: String(e?.message || e) });
      }
    });
  }
};
