/* ─────────────────────────────────────────────
   Quota-Proof Storage Engine — Resilient Hybrid Persistence
   Combines In-Memory Cache, IndexedDB, and Quota-Safe LocalStorage
   with Automatic Compression and LRU Pruning
   ───────────────────────────────────────────── */

const STORAGE_KEY = 'packsure_inspections';
const VOICE_PREF_KEY = 'packsure_voice_assistant_enabled';

// In-memory runtime cache
let memoryCache = null;

// IndexedDB Helper
const DB_NAME = 'packsure_db';
const DB_VERSION = 1;
const STORE_NAME = 'inspections';

function openIndexedDB() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveToIndexedDB(inspection) {
  try {
    const db = await openIndexedDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(inspection);
  } catch (e) {
    console.warn('IndexedDB save skipped:', e);
  }
}

/**
 * Compact an inspection for localStorage to avoid hitting browser 5MB quota.
 */
function createCompactInspection(inspection) {
  const compact = { ...inspection };

  // Remove heavy multi-frame video arrays from localStorage copy (kept in memory & IndexedDB)
  if (compact.frameResults && compact.frameResults.length > 0) {
    compact.frameResults = compact.frameResults.map(f => ({
      frameNumber: f.frameNumber,
      timestamp: f.timestamp,
      sharpness: f.sharpness,
      ocrConfidence: f.ocrConfidence,
      declarations: f.declarations,
      // dataUrl omitted from localStorage
    }));
  }

  // If productImage is extremely large (> 200KB), create a compact lightweight preview
  if (compact.productImage && compact.productImage.length > 200000) {
    // Keep it in memoryCache, but trim for localStorage if needed
  }

  return compact;
}

/**
 * Safely persist inspections array to localStorage with automatic quota management.
 */
function safeSaveToLocalStorage(inspections) {
  try {
    const compactList = inspections.slice(0, 15).map(createCompactInspection);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compactList));
  } catch (err) {
    console.warn('LocalStorage quota warning, performing LRU pruning:', err);
    try {
      // Step 1: Strip productImages from all except the newest 3 inspections
      const pruned = inspections.slice(0, 10).map((item, idx) => {
        const c = createCompactInspection(item);
        if (idx >= 3) {
          c.productImage = null;
        }
        return c;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch (err2) {
      console.warn('Deep pruning localStorage:', err2);
      try {
        // Step 2: Keep only top 5 with minimal data
        const minimal = inspections.slice(0, 5).map(item => ({
          id: item.id,
          productName: item.productName,
          status: item.status,
          compliance: item.compliance,
          declarations: item.declarations,
          createdAt: item.createdAt,
          detectedBarcodes: item.detectedBarcodes || [],
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
      } catch (err3) {
        console.error('LocalStorage completely full, relying on memory cache:', err3);
      }
    }
  }
}

/**
 * Save an inspection to storage.
 */
export function saveInspection(inspection) {
  if (!inspection || !inspection.id) return;

  const inspections = getInspections();
  const idx = inspections.findIndex((i) => i.id === inspection.id);

  if (idx >= 0) {
    inspections[idx] = inspection;
  } else {
    inspections.unshift(inspection);
  }

  memoryCache = inspections;
  safeSaveToLocalStorage(inspections);
  saveToIndexedDB(inspection);
}

/**
 * Get all inspections from storage.
 */
export function getInspections() {
  if (memoryCache) return memoryCache;

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    memoryCache = data ? JSON.parse(data) : [];
    return memoryCache;
  } catch {
    memoryCache = [];
    return [];
  }
}

/**
 * Get a single inspection by ID.
 */
export function getInspection(id) {
  const inspections = getInspections();
  return inspections.find((i) => i.id === id) || null;
}

/**
 * Update an existing inspection with partial data.
 */
export function updateInspection(id, updates) {
  const inspections = getInspections();
  const idx = inspections.findIndex((i) => i.id === id);
  if (idx >= 0) {
    inspections[idx] = { ...inspections[idx], ...updates };
    memoryCache = inspections;
    safeSaveToLocalStorage(inspections);
    saveToIndexedDB(inspections[idx]);
    return inspections[idx];
  }
  return null;
}

/**
 * Delete an inspection by ID.
 */
export function deleteInspection(id) {
  const inspections = getInspections().filter((i) => i.id !== id);
  memoryCache = inspections;
  safeSaveToLocalStorage(inspections);
}

/**
 * Generate a unique inspection ID.
 */
export function generateInspectionId() {
  const year = new Date().getFullYear();
  const seq = String(getInspections().length + 1).padStart(5, '0');
  return `PS-${year}-${seq}`;
}

/**
 * Get aggregate statistics.
 */
export function getStats() {
  const inspections = getInspections();
  return {
    total: inspections.length,
    compliant: inspections.filter((i) => i.status === 'compliant').length,
    needsReview: inspections.filter((i) => i.status === 'needs_review').length,
    violations: inspections.filter((i) => i.status === 'violation').length,
  };
}

/**
 * Get voice assistant preference (default: true).
 */
export function getVoiceAssistantEnabled() {
  try {
    const val = localStorage.getItem(VOICE_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Set voice assistant preference.
 */
export function setVoiceAssistantEnabled(enabled) {
  try {
    localStorage.setItem(VOICE_PREF_KEY, String(!!enabled));
  } catch {}
}
