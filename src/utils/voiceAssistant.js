/* ─────────────────────────────────────────────
   Voice Assistant Controller
   Web Speech API integration for PackSure
   Provides voice narration of 4 key declarations:
   1. MRP
   2. Use By / Expiry Date
   3. Net Wt (Net Quantity)
   4. Manufacture & Country of Origin
   ───────────────────────────────────────────── */

let currentUtterance = null;
let isSequenceRunning = false;
let isMuted = false;

/**
 * Check if Web Speech API is supported.
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Stop any active or queued speech immediately.
 */
export function stopSpeech() {
  isSequenceRunning = false;
  currentUtterance = null;
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.warn('Speech cancellation error:', e);
    }
  }
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
  const voices = window.speechSynthesis.getVoices() || [];
  
  // Prefer natural English voices (Google, Microsoft, Indian English, UK, US)
  const preferred = voices.find(v => 
    (v.lang.startsWith('en-IN') || v.lang.startsWith('en-GB') || v.lang.startsWith('en-US')) &&
    (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Ravi') || v.name.includes('Heera'))
  ) || voices.find(v => v.lang.startsWith('en'));

  return preferred || null;
}

/**
 * Speak a single text prompt.
 * @returns {Promise<boolean>}
 */
export function speakText(text, { rate = 1.0, pitch = 1.0 } = {}) {
  return new Promise((resolve) => {
    if (!isSpeechSupported() || isMuted || !text) {
      resolve(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance = utterance;

      const voice = getPreferredVoice();
      if (voice) utterance.voice = voice;

      utterance.rate = rate; // natural pace
      utterance.pitch = pitch;
      utterance.volume = 1.0;

      utterance.onend = () => {
        currentUtterance = null;
        resolve(true);
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        currentUtterance = null;
        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech speak error:', err);
      resolve(false);
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
  declarations.forEach(d => { declMap[d.field] = d; });

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
  let mrpStatus = mrp?.status === 'detected' ? 'compliant' : (mrp?.status === 'needs_review' ? 'needs_review' : 'violation');

  if (mrp && mrp.value && mrp.status !== 'not_detected') {
    const cleanPrice = mrp.value.replace(/[^0-9.]/g, '');
    const hasTax = /tax|incl/i.test(mrp.value);
    mrpText = `MRP detected: ${cleanPrice ? cleanPrice + ' rupees' : mrp.value}${hasTax ? ', inclusive of all taxes' : ''}.`;
  } else {
    mrpText = `Maximum Retail Price was not detected on the package label.`;
  }

  // 2. Use By / Expiry Date
  let expiryText = '';
  let expiryValue = '';
  let expiryStatus = 'compliant';

  if (dates.isNotApplicable || bestBefore?.status === 'not_applicable') {
    expiryValue = 'Not Applicable (Durable/Exempt)';
    expiryStatus = 'compliant';
    expiryText = `Use by date: Non-perishable commodity, expiry is legally exempt.`;
  } else if (dates.isExpired) {
    expiryValue = `EXPIRED (${dates.expiryDate || bestBefore?.value || 'Passed'})`;
    expiryStatus = 'violation';
    expiryText = `Warning: Product is expired. Expiry was ${dates.expiryDate || bestBefore?.value}. Distribution is prohibited.`;
  } else if (dates.isNearExpiry) {
    expiryValue = `Near Expiry (${dates.expiryDate || bestBefore?.value})`;
    expiryStatus = 'needs_review';
    expiryText = `Notice: Product is near expiry, expiring on ${dates.expiryDate || bestBefore?.value}.`;
  } else if (bestBefore && bestBefore.value && bestBefore.status !== 'not_detected') {
    expiryValue = dates.expiryDate ? `${bestBefore.value} (Expires ${dates.expiryDate})` : bestBefore.value;
    expiryStatus = 'compliant';
    expiryText = `Use by date detected: ${bestBefore.value}. Shelf life is safe and valid.`;
  } else {
    expiryValue = 'Not Detected';
    expiryStatus = 'violation';
    expiryText = `Use by and expiry date was not detected on this perishable item.`;
  }

  // 3. Net Wt (Net Quantity)
  let netQtyText = '';
  let netQtyValue = netQty?.value || 'Not Detected';
  let netQtyStatus = netQty?.status === 'detected' ? 'compliant' : (netQty?.status === 'needs_review' ? 'needs_review' : 'violation');

  if (netQty && netQty.value && netQty.status !== 'not_detected') {
    netQtyText = `Net weight declared: ${netQty.value} in standard metric units.`;
  } else {
    netQtyText = `Net quantity declaration was not found on the label.`;
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
    originText = `Manufactured by ${mfgName}. Country of origin: ${originCountry}.`;
  } else if (mfgName) {
    originValue = mfgName;
    originStatus = country?.status === 'not_detected' ? 'needs_review' : 'compliant';
    originText = `Manufactured by ${mfgName}. Country of origin was not detected.`;
  } else if (originCountry) {
    originValue = `Origin: ${originCountry}`;
    originStatus = 'needs_review';
    originText = `Country of origin: ${originCountry}. Manufacturer details not detected.`;
  } else {
    originValue = 'Not Detected';
    originStatus = 'violation';
    originText = `Manufacturer details and country of origin were not detected.`;
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
 * Allows user to stop in between anytime.
 */
export async function runVoiceAssistantSequence({
  items = [],
  enabled = true,
  onItemStart = () => {},
  onItemEnd = () => {},
  onComplete = () => {},
}) {
  if (!enabled || !isSpeechSupported() || isMuted) {
    // If voice is disabled/unsupported, simulate brief step transitions for visual delight
    for (let i = 0; i < items.length; i++) {
      onItemStart(i, items[i]);
      await new Promise(r => setTimeout(r, 600));
      onItemEnd(i, items[i]);
    }
    onComplete();
    return;
  }

  stopSpeech();
  isSequenceRunning = true;

  // Optional short intro
  onItemStart(-1, { title: 'Initializing AI Voice Assistant…' });
  await speakText('Label captured. Analyzing key declarations.', { rate: 1.05 });

  for (let i = 0; i < items.length; i++) {
    if (!isSequenceRunning) break;

    const item = items[i];
    onItemStart(i, item);

    await speakText(item.speechText, { rate: 1.0 });

    if (!isSequenceRunning) break;
    onItemEnd(i, item);
    // Slight breathing pause between items
    await new Promise(r => setTimeout(r, 250));
  }

  if (isSequenceRunning) {
    isSequenceRunning = false;
    onComplete();
  }
}
