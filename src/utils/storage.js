/* ─────────────────────────────────────────────
   LocalStorage wrapper for inspection data
   ───────────────────────────────────────────── */

const STORAGE_KEY = 'packsure_inspections';

/**
 * Save an inspection to localStorage.
 */
export function saveInspection(inspection) {
  const inspections = getInspections();
  // Replace existing or add new
  const idx = inspections.findIndex((i) => i.id === inspection.id);
  if (idx >= 0) {
    inspections[idx] = inspection;
  } else {
    inspections.unshift(inspection); // newest first
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inspections));
}

/**
 * Get all inspections from localStorage.
 */
export function getInspections() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inspections));
    return inspections[idx];
  }
  return null;
}

/**
 * Delete an inspection by ID.
 */
export function deleteInspection(id) {
  const inspections = getInspections().filter((i) => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inspections));
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
