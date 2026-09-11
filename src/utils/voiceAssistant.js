/* ─────────────────────────────────────────────
   Voice Assistant Controller
   Web Speech API integration for PackSure
   Provides voice narration of 4 key declarations:
   1. MRP
   2. Use By / Expiry Date
   3. Net Wt (Net Quantity)
   4. Manufacture & Country of Origin
   ───────────────────────────────────────────── */

let isSequenceRunning = false;
let isMuted = false;
let resumeIntervalId = null;

// Keep global reference on window to prevent Chromium garbage-collecting active utterance
if (typeof window !== 'undefined') {
  window.__packsureActiveUtterance = null;
}

/**
 * Check if Web Speech API is supported.
 */
export function isSpeechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

/**
 * Start keep-alive interval for Chromium speech synthesis.
 */
function startResumeInterval() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (resumeIntervalId) clearInterval(resumeIntervalId);
  resumeIntervalId = setInterval(() => {
    if (window.speechSynthesis && window.speechSynthesis.speaking && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 500);
}

/**
 * Stop keep-alive interval.
 */
function stopResumeInterval() {
  if (resumeIntervalId) {
    clearInterval(resumeIntervalId);
    resumeIntervalId = null;
  }
}

/**
 * Stop any active or queued speech immediately.
 */
export function stopSpeech() {
  isSequenceRunning = false;
  if (typeof window !== 'undefined') {
    window.__packsureActiveUtterance = null;
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('Speech cancellation error:', e);
      }
    }
  }
  stopResumeInterval();
}

/**
 * Set global mute state for voice assistant.
 */
export function setVoiceMuted(muted) {
  isMuted = !!muted;
  if (isMuted) {
    stopSpeech();
  }
}

/**
 * Get current mute state.
 */
export function getVoiceMuted() {
  return isMuted;
}

/**
 * Find best available English natural voice.
 */
function getPreferredVoice() {
  if (!isSpeechSupported()) return null;
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices || voices.length === 0) return null;

    const preferred =
      voices.find(
        (v) =>
          (v.lang.startsWith('en-IN') || v.lang.startsWith('en-GB') || v.lang.startsWith('en-US')) &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Ravi') ||
            v.name.includes('Heera') ||
            v.name.includes('Jenny'))
      ) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];

    return preferred || null;
  } catch (e) {
    return null;
  }
}

/**
 * Speak a single text prompt with watchdog safety timeout.
 * @returns {Promise<boolean>}
 */
export function speakText(text, { rate = 1.05, pitch = 1.0 } = {}) {
  return new Promise((resolve) => {
    if (!isSpeechSupported() || isMuted || !text || text.trim().length === 0) {
      resolve(false);
      return;
    }

    let isResolved = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof window !== 'undefined') {
        window.__packsureActiveUtterance = null;
      }
    };

    const done = (success) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(success);
      }
    };

    // Watchdog timer: automatically resolve if browser drops onend (Chromium bug)
    // Dynamic duration based on text length (approx 75ms per character, min 1.8s, max 4.5s)
    const watchdogMs = Math.min(4500, Math.max(1800, text.length * 75));
    timeoutId = setTimeout(() => {
      done(true);
    }, watchdogMs);

    try {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (typeof window !== 'undefined') {
        window.__packsureActiveUtterance = utterance;
      }

      const voice = getPreferredVoice();
      if (voice) utterance.voice = voice;

      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1.0;

      utterance.onend = () => {
        done(true);
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis event error:', e);
        done(false);
      };

      startResumeInterval();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech speak exception:', err);
      done(false);
    }
  });
}

/**
 * Generate natural spoken sentences for the 4 key declarations.
 * @param {Array} declarations
 * @param {Object} compliance
 * @param {Object} dateAssessment
 * @returns {Array<{ id: string, title: string, subtitle: string, icon: string, value: string, status: string, confidence: number, speechText: string }>}
 */
export function buildKeyDeclarationsData(declarations = [], compliance = {}, dateAssessment = null) {
  const declMap = {};
  declarations.forEach((d) => {
    declMap[d.field] = d;
  });

  const mfgDate = declMap['manufacturingDate'];
  const bestBefore = declMap['bestBefore'];
  const mrp = declMap['mrp'];
  const netQty = declMap['netQuantity'];
  const manufacturer = declMap['manufacturer'];
  const country = declMap['countryOfOrigin'];

  const dates = dateAssessment || compliance?.dateAssessment || {};

  // 1. MRP (Maximum Retail Price)
  let mrpText = '';
  let mrpValue = mrp?.value || 'Not Detected';
  let mrpStatus =
    mrp?.status === 'detected'
      ? 'compliant'
      : mrp?.status === 'needs_review'
      ? 'needs_review'
      : 'violation';

  if (mrp && mrp.value && mrp.status !== 'not_detected') {
    const cleanPrice = mrp.value.replace(/[^0-9.]/g, '');
    const hasTax = /tax|incl/i.test(mrp.value);
    mrpText = `MRP: ${cleanPrice ? cleanPrice + ' rupees' : mrp.value}${hasTax ? ', inclusive of taxes' : ''}.`;
  } else {
    mrpText = `Maximum Retail Price was not detected on label.`;
  }

  // 2. Use By / Expiry Date
  let expiryText = '';
  let expiryValue = '';
  let expiryStatus = 'compliant';

  if (dates.isNotApplicable || bestBefore?.status === 'not_applicable') {
    expiryValue = 'Not Applicable (Durable/Exempt)';
    expiryStatus = 'compliant';
    expiryText = `Use by date: Exempt commodity.`;
  } else if (dates.isExpired) {
    expiryValue = `EXPIRED (${dates.expiryDate || bestBefore?.value || 'Passed'})`;
    expiryStatus = 'violation';
    expiryText = `Warning: Product is expired as of ${dates.expiryDate || bestBefore?.value}.`;
  } else if (dates.isNearExpiry) {
    expiryValue = `Near Expiry (${dates.expiryDate || bestBefore?.value})`;
    expiryStatus = 'needs_review';
    expiryText = `Notice: Product is near expiry, on ${dates.expiryDate || bestBefore?.value}.`;
  } else if (bestBefore && bestBefore.value && bestBefore.status !== 'not_detected') {
    expiryValue = dates.expiryDate ? `${bestBefore.value} (Expires ${dates.expiryDate})` : bestBefore.value;
    expiryStatus = 'compliant';
    expiryText = `Use by date: ${bestBefore.value}. Valid shelf life.`;
  } else {
    expiryValue = 'Not Detected';
    expiryStatus = 'violation';
    expiryText = `Expiry date was not detected on this item.`;
  }

  // 3. Net Wt (Net Quantity)
  let netQtyText = '';
  let netQtyValue = netQty?.value || 'Not Detected';
  let netQtyStatus =
    netQty?.status === 'detected'
      ? 'compliant'
      : netQty?.status === 'needs_review'
      ? 'needs_review'
      : 'violation';

  if (netQty && netQty.value && netQty.status !== 'not_detected') {
    netQtyText = `Net weight declared: ${netQty.value}.`;
  } else {
    netQtyText = `Net quantity declaration was not found.`;
  }

  // 4. Manufacture & Country of Origin
  let originText = '';
  let originValue = '';
  let originStatus = 'compliant';

  const mfgName = manufacturer?.value ? manufacturer.value.split(',')[0].trim() : null;
  const originCountry = country?.value || null;

  if (mfgName && originCountry) {
    originValue = `${mfgName} • ${originCountry}`;
    originStatus = 'compliant';
    originText = `Manufactured by ${mfgName}. Origin: ${originCountry}.`;
  } else if (mfgName) {
    originValue = mfgName;
    originStatus = country?.status === 'not_detected' ? 'needs_review' : 'compliant';
    originText = `Manufactured by ${mfgName}.`;
  } else if (originCountry) {
    originValue = `Origin: ${originCountry}`;
    originStatus = 'needs_review';
    originText = `Country of origin: ${originCountry}.`;
  } else {
    originValue = 'Not Detected';
    originStatus = 'violation';
    originText = `Manufacturer details not detected.`;
  }

  return [
    {
      id: 'mrp',
      title: 'MRP (Max Retail Price)',
      subtitle: 'Rule 6(1)(e)',
      icon: 'Tag',
      value: mrpValue,
      status: mrpStatus,
      confidence: mrp?.confidence || 0,
      speechText: mrpText,
    },
    {
      id: 'useBy',
      title: 'Use By / Expiry Date',
      subtitle: 'Rule 6(1)(d)',
      icon: 'CalendarClock',
      value: expiryValue,
      status: expiryStatus,
      confidence: bestBefore?.confidence || 0,
      speechText: expiryText,
    },
    {
      id: 'netWeight',
      title: 'Net Wt / Quantity',
      subtitle: 'Rule 6(1)(c)',
      icon: 'Scale',
      value: netQtyValue,
      status: netQtyStatus,
      confidence: netQty?.confidence || 0,
      speechText: netQtyText,
    },
    {
      id: 'manufactureOrigin',
      title: 'Manufacture & Origin',
      subtitle: 'Rule 6(1)(a) & (g)',
      icon: 'Building2',
      value: originValue,
      status: originStatus,
      confidence: manufacturer?.confidence || country?.confidence || 0,
      speechText: originText,
    },
  ];
}

/**
 * Execute sequential voice narration of the 4 key items with active step callbacks.
 * Guarantees onComplete is called even if speech fails, is muted, or unsupported.
 */
export async function runVoiceAssistantSequence({
  items = [],
  enabled = true,
  introText = 'Package label captured. Verifying mandatory declarations.',
  onItemStart = () => {},
  onItemEnd = () => {},
  onComplete = () => {},
}) {
  const shouldSpeak = enabled && isSpeechSupported() && !isMuted;

  stopSpeech();
  isSequenceRunning = true;

  try {
    if (!shouldSpeak) {
      // Visual stepping mode (silent/muted/unsupported)
      for (let i = 0; i < items.length; i++) {
        if (!isSequenceRunning) break;
        onItemStart(i, items[i]);
        await new Promise((r) => setTimeout(r, 450));
        if (!isSequenceRunning) break;
        onItemEnd(i, items[i]);
      }
    } else {
      // Spoken voice mode
      onItemStart(-1, { title: 'AI Voice Assistant Starting…' });
      await speakText(introText, { rate: 1.05 });

      for (let i = 0; i < items.length; i++) {
        if (!isSequenceRunning) break;

        const item = items[i];
        onItemStart(i, item);

        await speakText(item.speechText, { rate: 1.05 });

        if (!isSequenceRunning) break;
        onItemEnd(i, item);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  } catch (err) {
    console.warn('Voice sequence encountered issue:', err);
  } finally {
    if (isSequenceRunning) {
      isSequenceRunning = false;
      stopResumeInterval();
      onComplete();
    }
  }
}

