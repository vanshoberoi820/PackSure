/* ─────────────────────────────────────────────
   Video Utilities — 8-Second Product Video Recording & Frame Extraction
   ───────────────────────────────────────────── */
import { calculateImageSharpness, resizeImage } from './imageUtils';

/**
 * Check if the current browser supports camera access and MediaRecorder.
 */
export function isVideoRecordingSupported() {
  return typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    typeof window !== 'undefined' &&
    !!window.MediaRecorder;
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
        width: { ideal: 1920 },
        height: { ideal: 1080 },
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
 * @returns {Promise<{ videoBlob: Blob, videoUrl: string }>}
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
    let startTime = 0;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      clearInterval(intervalId);
      const blobType = mimeType || 'video/webm';
      const videoBlob = new Blob(chunks, { type: blobType });
      const videoUrl = URL.createObjectURL(videoBlob);
      resolve({ videoBlob, videoUrl });
    };

    mediaRecorder.onerror = (err) => {
      clearInterval(intervalId);
      reject(err);
    };

    mediaRecorder.start(250); // Slice chunks every 250ms
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
 * Extract representative, high-sharpness frames from a video Blob.
 * Samples ~10-14 candidate timestamps and returns the sharpest non-duplicate frames.
 * @param {Blob|string} videoSource — video Blob or URL
 * @param {number} targetFrameCount — default 8-10 frames
 * @returns {Promise<Array<{ frameNumber: number, timestamp: string, timeSec: number, dataUrl: string, sharpness: number }>>}
 */
export async function extractFramesFromVideo(videoSource, targetFrameCount = 8) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const videoUrl = typeof videoSource === 'string' ? videoSource : URL.createObjectURL(videoSource);
    video.src = videoUrl;

    video.onloadedmetadata = async () => {
      const duration = video.duration || 8;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Generate sampling timestamps across 8 seconds (skipping initial 0.3s shake)
      const sampleTimes = [];
      const startSec = 0.4;
      const endSec = Math.max(0.5, duration - 0.4);
      const step = (endSec - startSec) / (targetFrameCount + 3);

      for (let t = startSec; t <= endSec; t += step) {
        sampleTimes.push(parseFloat(t.toFixed(2)));
      }

      const extractedCandidates = [];

      const captureFrameAt = (time) => {
        return new Promise((res) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const sharpness = calculateImageSharpness(canvas);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            res({
              timeSec: time,
              timestamp: formatTimestamp(time * 1000),
              dataUrl,
              sharpness,
            });
          };
          video.addEventListener('seeked', onSeeked, { once: true });
          video.currentTime = time;
        });
      };

      try {
        for (let i = 0; i < sampleTimes.length; i++) {
          const frame = await captureFrameAt(sampleTimes[i]);
          extractedCandidates.push(frame);
        }

        // Sort candidates by sharpness and pick the top non-blurry frames
        extractedCandidates.sort((a, b) => b.sharpness - a.sharpness);
        const topFrames = extractedCandidates.slice(0, targetFrameCount);

        // Re-sort chronologically for natural video playback and inspection timeline
        topFrames.sort((a, b) => a.timeSec - b.timeSec);

        const finalFrames = topFrames.map((f, idx) => ({
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
