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
let activeSpeechResolver = null;

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
  if (activeSpeechResolver) {
    try {
      activeSpeechResolver();
    } catch (_) {}
    activeSpeechResolver = null;
  }
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
      if (activeSpeechResolver) activeSpeechResolver = null;
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

    activeSpeechResolver = () => done(false);

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

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getOrdinalDay(day) {
  const j = day % 10, k = day % 100;
  if (j === 1 && k !== 11) return day + 'st';
  if (j === 2 && k !== 12) return day + 'nd';
  if (j === 3 && k !== 13) return day + 'rd';
  return day + 'th';
}

/**
 * Convert dates like "03/2026" or "15/08/2025" into natural spoken English ("March 2026", "15th August 2025")
 */
export function formatDateForSpeech(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return '';
  let str = rawStr.trim();

  // If already relative phrase like "12 months from packing"
  if (/(\d+)\s*months?/i.test(str)) {
    return str
      .replace(/mfg\.?|mfd\.?/gi, 'manufacture')
      .replace(/pkg\.?|pkd\.?|pack(?:ing)?/gi, 'packing');
  }

  // Remove mfg/pkg prefixes if present
  str = str.replace(/^(?:mfg\.?|mfd\.?|pkg\.?|pkd\.?|exp\.?|best before|use by|date|on|of)\s*[:\-.]?\s*/gi, '').trim();

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthIdx = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    if (monthIdx >= 0 && monthIdx <= 11 && day >= 1 && day <= 31) {
      return `${getOrdinalDay(day)} ${FULL_MONTH_NAMES[monthIdx]} ${year}`;
    }
  }

  // Match MM/YYYY or MM-YYYY or MM.YYYY or MM/YY
  const myMatch = str.match(/^(\d{1,2})[\/\-\.](\d{2,4})$/);
  if (myMatch) {
    const monthIdx = parseInt(myMatch[1], 10) - 1;
    let year = parseInt(myMatch[2], 10);
    if (year < 100) year += 2000;
    if (monthIdx >= 0 && monthIdx <= 11) {
      return `${FULL_MONTH_NAMES[monthIdx]} ${year}`;
    }
  }

  // Match Day MonthName Year: "28 APR 2026", "15 August 2025"
  const dayNamedMatch = str.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (dayNamedMatch) {
    const day = parseInt(dayNamedMatch[1], 10);
    const monKey = dayNamedMatch[2].toLowerCase().substring(0, 3);
    const monthLookup = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    if (monKey in monthLookup) {
      let year = parseInt(dayNamedMatch[3], 10);
      if (year < 100) year += 2000;
      return `${getOrdinalDay(day)} ${FULL_MONTH_NAMES[monthLookup[monKey]]} ${year}`;
    }
  }

  // Match MonthName Year: "APR 2026", "April 2026"
  const namedMatch = str.match(/^([A-Za-z]{3,9})\s*[,']?\s*(\d{2,4})$/i);
  if (namedMatch) {
    const monKey = namedMatch[1].toLowerCase().substring(0, 3);
    const monthLookup = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    if (monKey in monthLookup) {
      const monthIdx = monthLookup[monKey];
      let year = parseInt(namedMatch[2], 10);
      if (year < 100) year += 2000;
      return `${FULL_MONTH_NAMES[monthIdx]} ${year}`;
    }
  }

  return str;
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
    let cleanPrice = mrp.value.replace(/[^0-9.]/g, '');
    if (cleanPrice.endsWith('.00') || cleanPrice.endsWith('.0')) {
      cleanPrice = cleanPrice.replace(/\.00?$/, '');
    }
    const hasTax = /tax|incl/i.test(mrp.value);
    mrpText = `Maximum Retail Price: ${cleanPrice ? cleanPrice + ' rupees' : mrp.value}${hasTax ? ', inclusive of all taxes' : ''}.`;
  } else {
    mrpText = `Maximum Retail Price was not detected on label.`;
  }

  // 2. Manufacturing / Packing Date (Dedicated Step)
  let mfgText = '';
  let mfgValue = mfgDate?.value || 'Not Detected';
  let mfgStatus = mfgDate?.status === 'detected' ? 'compliant' : mfgDate?.status === 'needs_review' ? 'needs_review' : 'violation';

  if (dates.isFutureDated) {
    mfgStatus = 'violation';
    mfgValue = `${mfgDate?.value} (Future Dated)`;
    mfgText = `Warning: Manufacturing date ${formatDateForSpeech(mfgDate?.value)} is post-dated.`;
  } else if (mfgDate && mfgDate.value && mfgDate.status !== 'not_detected') {
    const mfgSpoken = formatDateForSpeech(mfgDate.value);
    mfgText = `Manufacturing date: ${mfgSpoken}.`;
  } else {
    mfgText = `Manufacturing date was not detected.`;
  }

  // 3. Use By / Expiry Date (Dedicated Step)
  let expiryText = '';
  let expiryValue = '';
  let expiryStatus = 'compliant';

  if (dates.isNotApplicable || bestBefore?.status === 'not_applicable') {
    expiryValue = 'Not Applicable (Durable / Exempt)';
    expiryStatus = 'compliant';
    expiryText = `Use by date: Exempt durable commodity.`;
  } else if (dates.isExpired) {
    const expSpoken = formatDateForSpeech(dates.expiryDate || bestBefore?.value);
    expiryValue = `EXPIRED (${dates.expiryDate || bestBefore?.value || 'Passed'})`;
    expiryStatus = 'violation';
    expiryText = `Warning: Product is expired as of ${expSpoken}. Distribution prohibited.`;
  } else if (dates.isNearExpiry) {
    const expSpoken = formatDateForSpeech(dates.expiryDate || bestBefore?.value);
    expiryValue = `Near Expiry (${dates.expiryDate || bestBefore?.value})`;
    expiryStatus = 'needs_review';
    expiryText = `Notice: Product is near expiry on ${expSpoken}, with ${dates.daysToExpiry} days remaining.`;
  } else if (bestBefore && bestBefore.value && bestBefore.status !== 'not_detected') {
    const expSpoken = formatDateForSpeech(bestBefore.value);
    if (dates.isComputedExpiry && dates.expiryDate) {
      const compSpoken = formatDateForSpeech(dates.expiryDate);
      expiryValue = `${bestBefore.value} (Expires ${dates.expiryDate})`;
      expiryStatus = 'compliant';
      expiryText = `Best before: ${expSpoken}, expiring in ${compSpoken}. Valid shelf life.`;
    } else {
      expiryValue = bestBefore.value;
      expiryStatus = 'compliant';
      expiryText = `Use by date: ${expSpoken}. Valid shelf life.`;
    }
  } else {
    expiryValue = 'Not Detected';
    expiryStatus = 'violation';
    expiryText = `Expiry date was not detected on this item.`;
  }

  // 4. Net Wt (Net Quantity)
  let netQtyText = '';
  let netQtyValue = netQty?.value || 'Not Detected';
  let netQtyStatus =
    netQty?.status === 'detected'
      ? 'compliant'
      : netQty?.status === 'needs_review'
      ? 'needs_review'
      : 'violation';

  if (netQty && netQty.value && netQty.status !== 'not_detected') {
    const cleanQty = netQty.value
      .replace(/\bkg\b/gi, 'kilograms')
      .replace(/\bgms?\b|\bg\b/gi, 'grams')
      .replace(/\bml\b/gi, 'millilitres')
      .replace(/\bltr?s?\b|\bl\b/gi, 'litres')
      .replace(/\bpc?s\b|\bn\b/gi, 'units');
    netQtyText = `Net quantity declared: ${cleanQty}.`;
  } else {
    netQtyText = `Net quantity declaration was not found.`;
  }

  // 5. Manufacture & Country of Origin
  let originText = '';
  let originValue = '';
  let originStatus = 'compliant';

  const mfgName = manufacturer?.value ? manufacturer.value.split(',')[0].trim() : null;
  const originCountry = country?.value || null;

  if (mfgName && originCountry) {
    originValue = `${mfgName} • ${originCountry}`;
    originStatus = 'compliant';
    originText = `Manufactured by ${mfgName}. Country of origin: ${originCountry}.`;
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
      id: 'mfgDate',
      title: 'Manufacturing / Packing Date',
      subtitle: 'Rule 6(1)(d)',
      icon: 'Calendar',
      value: mfgValue,
      status: mfgStatus,
      confidence: mfgDate?.confidence || 0,
      speechText: mfgText,
    },
    {
      id: 'useBy',
      title: 'Use By / Expiry Date',
      subtitle: 'Rule 6(1)(d) proviso',
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

