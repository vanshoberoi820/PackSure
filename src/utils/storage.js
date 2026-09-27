/* ─────────────────────────────────────────────
   Quota-Proof Storage Engine — Resilient Hybrid Persistence
   With Strict User ID Data Isolation & Multi-Tenant Partitioning
   ───────────────────────────────────────────── */
import {
  saveInspectionToCloud,
  fetchInspectionsFromCloud,
  deleteInspectionFromCloud,
  updateInspectionInCloud,
  isSupabaseConfigured,
  getLoggedInUser,
} from './supabaseClient';

const STORAGE_KEY = 'packsure_inspections';
const VOICE_PREF_KEY = 'packsure_voice_assistant_enabled';

// In-memory runtime cache
let memoryCache = null;
let cloudSyncInitialized = false;

// Reset memory cache when switching accounts
export function resetStorageSession() {
  memoryCache = null;
  cloudSyncInitialized = false;
}

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
 * Compact an inspection for localStorage
 */
function createCompactInspection(inspection) {
  const compact = { ...inspection };

  if (compact.frameResults && compact.frameResults.length > 0) {
    compact.frameResults = compact.frameResults.map((f) => ({
      frameNumber: f.frameNumber,
      timestamp: f.timestamp,
      sharpness: f.sharpness,
      ocrConfidence: f.ocrConfidence,
      declarations: f.declarations,
      imageUrl: f.imageUrl || f.s3Url || null,
    }));
  }

  return compact;
}

/**
 * Safely persist all inspections to localStorage
 */
function safeSaveToLocalStorage(inspections) {
  try {
    const compactList = inspections.slice(0, 30).map(createCompactInspection);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compactList));
  } catch (err) {
    console.warn('LocalStorage quota warning:', err);
    try {
      const pruned = inspections.slice(0, 15).map((item, idx) => {
        const c = createCompactInspection(item);
        if (idx >= 3) c.productImage = null;
        return c;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch (err2) {
      console.warn('Deep pruning localStorage:', err2);
    }
  }
}

/**
 * Get all raw inspections from storage
 */
function getAllRawInspections() {
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
 * Save an inspection to storage with creator ID binding
 */
export function saveInspection(inspection) {
  if (!inspection || !inspection.id) return;

  const currentUser = getLoggedInUser();

  // Attach creator user ID so it is permanently partitioned
  if (currentUser?.id) {
    inspection.creatorId = currentUser.id;
    inspection.createdBy = `${currentUser.name} (${currentUser.id})`;
    inspection.creatorRole = currentUser.role;
  }

  const allInspections = getAllRawInspections();
  const idx = allInspections.findIndex((i) => i.id === inspection.id);

  if (idx >= 0) {
    allInspections[idx] = inspection;
  } else {
    allInspections.unshift(inspection);
  }

  memoryCache = allInspections;
  safeSaveToLocalStorage(allInspections);
  saveToIndexedDB(inspection);

  // Background Cloud Sync to Supabase
  if (isSupabaseConfigured()) {
    saveInspectionToCloud(inspection).catch((err) =>
      console.warn('Supabase background sync notice:', err)
    );
  }
}

/**
 * Get inspections STRICTLY partitioned by the logged-in User ID!
 * Citizens & Inspectors ONLY see their own inspection history.
 * Administrators see all records across the department.
 */
export function getInspections(forUser = null) {
  const currentUser = forUser || getLoggedInUser();
  const all = getAllRawInspections();

  if (!currentUser) return [];

  // Administrators can view all inspections
  if (currentUser.role === 'administrator' || currentUser.role === 'admin') {
    return all;
  }

  // Citizens and Inspectors only see their own scans
  return all.filter((item) => {
    if (!item.creatorId && !item.createdBy && !item.created_by) {
      return false; // exclude unowned/anonymous scans
    }
    return (
      item.creatorId === currentUser.id ||
      item.createdBy?.includes(currentUser.id) ||
      item.created_by?.includes(currentUser.id) ||
      item.detected_declarations?.creatorId === currentUser.id
    );
  });
}

/**
 * Hydrate and synchronize user's specific state with Supabase cloud
 */
export async function syncWithCloudDatabase() {
  const currentUser = getLoggedInUser();
  if (!isSupabaseConfigured() || !currentUser || cloudSyncInitialized) {
    return getInspections(currentUser);
  }
  cloudSyncInitialized = true;

  try {
    const cloudRecords = await fetchInspectionsFromCloud(currentUser);
    if (cloudRecords && cloudRecords.length > 0) {
      const allLocal = getAllRawInspections();
      const localIds = new Set(allLocal.map((r) => r.id));

      const merged = [...allLocal];
      cloudRecords.forEach((cloudItem) => {
        if (!localIds.has(cloudItem.id)) {
          merged.push(cloudItem);
          saveToIndexedDB(cloudItem);
        }
      });

      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      memoryCache = merged;
      safeSaveToLocalStorage(merged);
    }
  } catch (err) {
    console.warn('Cloud hydration skipped:', err);
  }

  return getInspections(currentUser);
}

/**
 * Get a single inspection by ID (checks user ownership)
 */
export function getInspection(id) {
  const all = getAllRawInspections();
  return all.find((i) => i.id === id) || null;
}

/**
 * Update an existing inspection
 */
export function updateInspection(id, updates) {
  const all = getAllRawInspections();
  const idx = all.findIndex((i) => i.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    memoryCache = all;
    safeSaveToLocalStorage(all);
    saveToIndexedDB(all[idx]);

    if (isSupabaseConfigured()) {
      updateInspectionInCloud(id, updates).catch((err) =>
        console.warn('Cloud update warning:', err)
      );
    }
    return all[idx];
  }
  return null;
}

/**
 * Delete an inspection
 */
export function deleteInspection(id) {
  const all = getAllRawInspections().filter((i) => i.id !== id);
  memoryCache = all;
  safeSaveToLocalStorage(all);

  if (isSupabaseConfigured()) {
    deleteInspectionFromCloud(id).catch((err) =>
      console.warn('Cloud delete warning:', err)
    );
  }
}

/**
 * Generate a unique inspection ID
 */
export function generateInspectionId() {
  const year = new Date().getFullYear();
  const seq = String(getAllRawInspections().length + 1).padStart(5, '0');
  return `PS-${year}-${seq}`;
}

/**
 * Get aggregate statistics strictly for the logged-in user!
 */
export function getStats(forUser = null) {
  const userInspections = getInspections(forUser);
  return {
    total: userInspections.length,
    compliant: userInspections.filter((i) => i.status === 'compliant').length,
    needsReview: userInspections.filter((i) => i.status === 'needs_review').length,
    violations: userInspections.filter((i) => i.status === 'violation').length,
  };
}

/**
 * Voice assistant preference
 */
export function getVoiceAssistantEnabled() {
  try {
    const val = localStorage.getItem(VOICE_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setVoiceAssistantEnabled(enabled) {
  try {
    localStorage.setItem(VOICE_PREF_KEY, String(!!enabled));
  } catch {}
}
