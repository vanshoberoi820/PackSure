/* ─────────────────────────────────────────────
   Video Utilities — 15-Second Product Video Recording & Sharp Multi-Angle Frame Extraction
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
 * Request high-resolution rear/environment camera video stream.
 */
export async function getCameraStream() {
  if (!isVideoRecordingSupported()) {
    throw new Error('Camera recording is not supported in this browser.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: false,
    });
    return stream;
  } catch (err) {
    console.error('Camera access error with HD constraints, trying basic constraints:', err);
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });
      return fallbackStream;
    } catch (fallbackErr) {
      console.error('Camera access error:', fallbackErr);
      throw new Error('Camera permission denied or camera unavailable.');
    }
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
 * Record a 15-second product video from an active camera stream with live progress and early-stop capability.
 * @param {MediaStream} stream
 * @param {Object} options — { durationMs: 15000, onProgress: ({ elapsedMs, remainingSec, progressPct }) }
 * @returns {{ promise: Promise<{ videoBlob: Blob, videoUrl: string, durationMs: number }>, stop: Function }}
 */
export function recordProductVideo(stream, { durationMs = 15000, onProgress = () => {} } = {}) {
  let stopRecordingFn = null;

  const promise = new Promise((resolve, reject) => {
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
      if (intervalId) clearInterval(intervalId);
      const actualDuration = Date.now() - startTime;
      const blobType = mimeType || 'video/webm';
      const videoBlob = new Blob(chunks, { type: blobType });
      const videoUrl = URL.createObjectURL(videoBlob);
      resolve({ videoBlob, videoUrl, durationMs: actualDuration });
    };

    stopRecordingFn = () => {
      if (isFinished) return;
      if (intervalId) clearInterval(intervalId);
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      } else {
        finish();
      }
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
      if (intervalId) clearInterval(intervalId);
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
        stopRecordingFn();
      }
    }, 100);
  });

  return {
    promise,
    stop: () => {
      if (stopRecordingFn) stopRecordingFn();
    },
  };
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
 * Uses 5 strategically spaced key frames covering 360° rotation.
 * Samples micro candidate frames per interval and picks highest sharpness to prevent blur.
 * Uses 1280x720 canvas for high OCR readability without excessive memory overhead.
 * @param {Blob|string} videoSource — video Blob or URL
 * @param {number|Object} targetConfig — frame count or options object { targetFrameCount: 5, durationMs: 15000 }
 * @returns {Promise<Array<{ frameNumber: number, timestamp: string, timeSec: number, dataUrl: string, sharpness: number }>>}
 */
export async function extractFramesFromVideo(videoSource, targetConfig = 5) {
  const targetFrameCount = typeof targetConfig === 'number' ? targetConfig : (targetConfig?.targetFrameCount || 5);
  const fallbackDurationMs = typeof targetConfig === 'object' && targetConfig?.durationMs ? targetConfig.durationMs : 15000;

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

      // Crisp HD resolution (1280 max width) for sharp text detection without blur
      let canvasW = video.videoWidth || 1280;
      let canvasH = video.videoHeight || 720;
      if (canvasW > 1280) {
        const ratio = 1280 / canvasW;
        canvasW = 1280;
        canvasH = Math.round(canvasH * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Generate base sampling timestamps across recorded duration
      const sampleWindows = [];
      const startSec = Math.min(1.0, duration * 0.08);
      const endSec = Math.max(startSec + 1, duration - 0.5);
      const step = (endSec - startSec) / Math.max(1, targetFrameCount - 1);

      for (let i = 0; i < targetFrameCount; i++) {
        const t = Math.min(endSec, startSec + i * step);
        sampleWindows.push(parseFloat(t.toFixed(2)));
      }

      const extractedFinalFrames = [];

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
              const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
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
                dataUrl: canvas.toDataURL('image/jpeg', 0.85),
                sharpness: 50,
              });
            }
          };

          // Watchdog timeout in case seeked doesn't fire
          setTimeout(() => {
            if (!hasSeeked) {
              onSeeked();
            }
          }, 1000);

          video.addEventListener('seeked', onSeeked, { once: true });
          try {
            video.currentTime = Math.max(0, Math.min(time, duration - 0.05));
          } catch (e) {
            onSeeked();
          }
        });
      };

      try {
        for (let i = 0; i < sampleWindows.length; i++) {
          const centerTime = sampleWindows[i];
          // Sample 3 micro candidates: center - 0.2s, center, center + 0.2s
          const microCandidates = [];
          const offsets = [-0.2, 0, 0.2];
          
          for (const off of offsets) {
            const candidateTime = Math.max(0.2, Math.min(duration - 0.1, centerTime + off));
            const frame = await captureFrameAt(candidateTime);
            microCandidates.push(frame);
          }

          // Pick the candidate frame with highest sharpness to eliminate motion blur
          microCandidates.sort((a, b) => b.sharpness - a.sharpness);
          const sharpestFrame = microCandidates[0];

          extractedFinalFrames.push({
            frameNumber: i + 1,
            timestamp: sharpestFrame.timestamp,
            timeSec: sharpestFrame.timeSec,
            dataUrl: sharpestFrame.dataUrl,
            sharpness: sharpestFrame.sharpness,
          });
        }

        resolve(extractedFinalFrames);
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
