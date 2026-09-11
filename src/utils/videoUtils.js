/* ─────────────────────────────────────────────
   Video Utilities — 8-Second Product Video Recording & Frame Extraction
   ───────────────────────────────────────────── */
import { calculateImageSharpness, resizeImage } from './imageUtils';

/**
 * Check if the current browser supports camera access and MediaRecorder.
 */
export function isVideoRecordingSupported() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    typeof window !== 'undefined' &&
    !!window.MediaRecorder
  );
}

/**
 * Request rear/environment camera video stream.
 */
export async function getCameraStream() {
  if (!isVideoRecordingSupported()) {
    throw new Error('Camera recording is not supported in this browser.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
      },
      audio: false,
    });
    return stream;
  } catch (err) {
    console.error('Camera access error:', err);
    throw new Error('Camera permission denied or camera unavailable.');
  }
}

/**
 * Stop and release all tracks on a MediaStream.
 */
export function stopMediaStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => track.stop());
  } catch (e) {
    console.warn('Error stopping stream tracks:', e);
  }
}

/**
 * Get supported video MIME type for MediaRecorder.
 */
function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

/**
 * Record an 8-second video from an active camera stream with live progress and cancel handlers.
 * @param {MediaStream} stream
 * @param {Object} options — { durationMs: 8000, onProgress: ({ elapsedMs, remainingSec, progressPct }) }
 * @returns {Promise<{ videoBlob: Blob, videoUrl: string, durationMs: number }>}
 */
export function recordProductVideo(stream, { durationMs = 8000, onProgress = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : undefined;

    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      return reject(new Error('Failed to initialize MediaRecorder: ' + e.message));
    }

    const chunks = [];
    let intervalId = null;
    let startTime = Date.now();
    let isFinished = false;

    const finish = () => {
      if (isFinished) return;
      isFinished = true;
      clearInterval(intervalId);
      const actualDuration = Date.now() - startTime;
      const blobType = mimeType || 'video/webm';
      const videoBlob = new Blob(chunks, { type: blobType });
      const videoUrl = URL.createObjectURL(videoBlob);
      resolve({ videoBlob, videoUrl, durationMs: actualDuration });
    };

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      finish();
    };

    mediaRecorder.onerror = (err) => {
      clearInterval(intervalId);
      reject(err);
    };

    mediaRecorder.start(250);
    startTime = Date.now();

    intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressPct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      const remainingSec = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));

      onProgress({ elapsedMs: elapsed, remainingSec, progressPct });

      if (elapsed >= durationMs) {
        clearInterval(intervalId);
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        } else {
          finish();
        }
      }
    }, 100);
  });
}

/**
 * Format milliseconds into standard video timestamp string (e.g. 3500ms -> "00:03.5").
 */
export function formatTimestamp(ms) {
  const totalSec = ms / 1000;
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.floor(totalSec % 60);
  const tenths = Math.floor((totalSec % 1) * 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

/**
 * Extract representative, high-sharpness key frames from a video Blob.
 * Uses 4 strategically spaced key frames covering 360° rotation (Front, Right, Back, Left).
 * Downscales for optimal OCR speed (max 960x540).
 * @param {Blob|string} videoSource — video Blob or URL
 * @param {number|Object} targetConfig — frame count or options object { targetFrameCount: 4, durationMs: 8000 }
 * @returns {Promise<Array<{ frameNumber: number, timestamp: string, timeSec: number, dataUrl: string, sharpness: number }>>}
 */
export async function extractFramesFromVideo(videoSource, targetConfig = 4) {
  const targetFrameCount = typeof targetConfig === 'number' ? targetConfig : (targetConfig?.targetFrameCount || 4);
  const fallbackDurationMs = typeof targetConfig === 'object' && targetConfig?.durationMs ? targetConfig.durationMs : 8000;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const videoUrl = typeof videoSource === 'string' ? videoSource : URL.createObjectURL(videoSource);
    video.src = videoUrl;

    video.onloadedmetadata = async () => {
      // Fix Chromium WebM duration === Infinity bug
      let duration = video.duration;
      if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
        duration = fallbackDurationMs / 1000;
      }

      // Downscale to 960x540 max for 3-4x faster OCR inference
      let canvasW = video.videoWidth || 960;
      let canvasH = video.videoHeight || 540;
      if (canvasW > 960) {
        const ratio = 960 / canvasW;
        canvasW = 960;
        canvasH = Math.round(canvasH * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Generate sampling timestamps across 8 seconds
      // For 4 frames across 8s: ~1.0s (Front), ~3.0s (Side A), ~5.0s (Back), ~7.0s (Side B)
      const sampleTimes = [];
      const startSec = 0.8;
      const endSec = Math.max(startSec + 1, duration - 0.6);
      const step = (endSec - startSec) / Math.max(1, targetFrameCount - 1);

      for (let i = 0; i < targetFrameCount; i++) {
        const t = Math.min(endSec, startSec + i * step);
        sampleTimes.push(parseFloat(t.toFixed(2)));
      }

      const extractedCandidates = [];

      const captureFrameAt = (time) => {
        return new Promise((res) => {
          let hasSeeked = false;

          const onSeeked = () => {
            if (hasSeeked) return;
            hasSeeked = true;
            video.removeEventListener('seeked', onSeeked);
            try {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const sharpness = calculateImageSharpness(canvas);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
              res({
                timeSec: time,
                timestamp: formatTimestamp(time * 1000),
                dataUrl,
                sharpness,
              });
            } catch (err) {
              res({
                timeSec: time,
                timestamp: formatTimestamp(time * 1000),
                dataUrl: canvas.toDataURL('image/jpeg', 0.8),
                sharpness: 50,
              });
            }
          };

          // Watchdog timeout in case seeked doesn't fire
          setTimeout(() => {
            if (!hasSeeked) {
              onSeeked();
            }
          }, 1200);

          video.addEventListener('seeked', onSeeked, { once: true });
          try {
            video.currentTime = Math.max(0, Math.min(time, duration - 0.1));
          } catch (e) {
            onSeeked();
          }
        });
      };

      try {
        for (let i = 0; i < sampleTimes.length; i++) {
          const frame = await captureFrameAt(sampleTimes[i]);
          extractedCandidates.push(frame);
        }

        const finalFrames = extractedCandidates.map((f, idx) => ({
          frameNumber: idx + 1,
          timestamp: f.timestamp,
          timeSec: f.timeSec,
          dataUrl: f.dataUrl,
          sharpness: f.sharpness,
        }));

        resolve(finalFrames);
      } catch (err) {
        console.error('Frame extraction failed:', err);
        reject(err);
      } finally {
        if (typeof videoSource !== 'string') {
          URL.revokeObjectURL(videoUrl);
        }
      }
    };

    video.onerror = (e) => {
      reject(new Error('Failed to load video for frame extraction.'));
    };
  });
}

