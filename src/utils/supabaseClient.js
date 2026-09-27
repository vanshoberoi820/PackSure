/* ─────────────────────────────────────────────
   Supabase Cloud Database & WebAuthn Passkey Client
   Handles PostgreSQL sync, Passkey/Biometrics, Auth, and Profiles
   ───────────────────────────────────────────── */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = () => {
  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

const REGISTERED_USERS_KEY = 'packsure_registered_users';

/**
 * Generate a clean, official Unique Identifier based on Role
 * @param {'citizen' | 'inspector' | 'administrator'} role
 * @returns {string} e.g. 'PS-INS-84920'
 */
export function generateUniqueUserId(role = 'inspector') {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  switch (role?.toLowerCase()) {
    case 'citizen':
    case 'consumer':
      return `PS-CTZ-${randomNum}`;
    case 'administrator':
    case 'admin':
      return `PS-ADM-${randomNum}`;
    case 'inspector':
    default:
      return `PS-INS-${randomNum}`;
  }
}

/**
 * Get all registered accounts stored in client registry
 */
export function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Register a user into the account registry and Supabase
 */
export function registerAccount(user) {
  const users = getRegisteredUsers();
  const cleanEmail = user.email?.trim().toLowerCase();
  const cleanPhone = user.phone ? user.phone.replace(/\D/g, '') : null;

  const idx = users.findIndex(
    (u) =>
      (cleanEmail && u.email?.toLowerCase() === cleanEmail) ||
      (cleanPhone && u.phone?.replace(/\D/g, '') === cleanPhone)
  );

  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user };
  } else {
    users.push(user);
  }

  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Failed to save account to registry:', e);
  }
}

/**
 * Find user in registry
 */
export function findRegisteredUser(identifier, password = null) {
  const users = getRegisteredUsers();
  const clean = identifier?.trim().toLowerCase();
  const cleanDigits = identifier?.replace(/\D/g, '');

  const user = users.find(
    (u) =>
      (u.email && u.email.toLowerCase() === clean) ||
      (cleanDigits && u.phone && u.phone.replace(/\D/g, '') === cleanDigits) ||
      (u.id && u.id.toLowerCase() === clean)
  );

  if (!user) return null;
  if (password && user.password && user.password !== password) {
    return { error: 'invalid_password' };
  }
  return user;
}

/**
 * Save user profile to Supabase database (app_users) and local session
 * @param {Object} profile
 */
export async function saveUserProfileToCloud(profile) {
  if (!profile) return;

  // 1. Local session persistence
  try {
    localStorage.setItem('packsure_officer', JSON.stringify(profile));
  } catch (e) {
    console.warn('Failed to save user session locally:', e);
  }

  // 2. Cloud Supabase persistence
  if (supabase) {
    try {
      const payload = {
        id: profile.id,
        name: profile.name || profile.fullName || 'User',
        role: profile.role || 'inspector',
        email: profile.email || null,
        phone: profile.phone || null,
        password: profile.password || null,
        passkey_enabled: profile.passkeyEnabled !== false,
        created_at: profile.createdAt || new Date().toISOString(),
      };

      const { error } = await supabase.from('app_users').upsert(payload, { onConflict: 'id' });
      if (!error) {
        console.log('✅ User profile synced to Supabase app_users:', profile.id);
      }
    } catch (err) {
      console.warn('Profile cloud sync skipped:', err);
    }
  }
}

/**
 * WebAuthn Passkey Helper Engine (Fingerprint / Face ID / Windows Hello)
 */
export const passkeyService = {
  // Check if browser/device supports WebAuthn Passkeys
  isSupported() {
    return !!(
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === 'function' &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function'
    );
  },

  // Register device passkey
  async createPasskey(userName, userDisplayName) {
    if (!this.isSupported()) {
      return { success: true, fallback: true };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PackSure Legal Metrology' },
          user: {
            id: userId,
            name: userName || 'officer@packsure.gov.in',
            displayName: userDisplayName || 'PackSure Officer',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Device Biometric (Touch ID / Face ID / Windows Hello)
            userVerification: 'preferred',
          },
          timeout: 45000,
          attestation: 'none',
        },
      });

      return { success: !!credential, credentialId: credential?.id };
    } catch (err) {
      console.info('Passkey creation fallback notice:', err.message);
      // If user cancels or browser doesn't have platform sensor, proceed safely
      return { success: true, fallback: true };
    }
  },

  // Verify / Login with Passkey
  async verifyPasskey() {
    if (!this.isSupported()) {
      return { success: true, fallback: true };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 45000,
          userVerification: 'preferred',
        },
      });

      return { success: !!assertion, id: assertion?.id };
    } catch (err) {
      console.info('Passkey verification notice:', err.message);
      return { success: false, error: err.message };
    }
  },
};

/**
 * Check if a user is currently logged in
 */
export function isAuthenticated() {
  try {
    const raw = localStorage.getItem('packsure_officer');
    return !!raw;
  } catch {
    return false;
  }
}

/**
 * Get current logged in user session
 */
export function getLoggedInUser() {
  try {
    const raw = localStorage.getItem('packsure_officer');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Save or update an inspection record in Supabase Cloud Database.
 */
export async function saveInspectionToCloud(inspection) {
  if (!supabase || !inspection || !inspection.id) {
    return { success: false, error: 'Supabase not initialized' };
  }

  try {
    const currentUser = getLoggedInUser();
    const mrp = inspection.declarations?.find((d) => d.field === 'mrp')?.value || '';
    const netQuantity = inspection.declarations?.find((d) => d.field === 'netQuantity')?.value || '';
    const mfgDate = inspection.declarations?.find((d) => d.field === 'mfgDate')?.value || '';
    const expiryDate = inspection.declarations?.find((d) => d.field === 'expiryDate')?.value || '';
    const countryOfOrigin = inspection.declarations?.find((d) => d.field === 'countryOfOrigin')?.value || '';
    const manufacturerAddress = inspection.declarations?.find((d) => d.field === 'manufacturerAddress')?.value || '';
    const brand = inspection.declarations?.find((d) => d.field === 'brand')?.value || '';
    const barcode = inspection.detectedBarcodes?.[0] || '';

    const inspectionPayload = {
      id: inspection.id,
      product_name: inspection.productName || 'Unknown Product',
      brand: brand || null,
      barcode: barcode || null,
      status: inspection.status || 'needs_review',
      compliance_score: inspection.compliance?.score || 0,
      mrp: mrp || null,
      net_quantity: netQuantity || null,
      mfg_date: mfgDate || null,
      expiry_date: expiryDate || null,
      country_of_origin: countryOfOrigin || null,
      manufacturer_address: manufacturerAddress || null,
      product_image_url: inspection.productImage || null,
      detected_declarations: {
        declarations: inspection.declarations || [],
        compliance: inspection.compliance || {},
        ocrText: inspection.ocrText || '',
        ocrConfidence: inspection.ocrConfidence || 0,
        scanMetadata: inspection.scanMetadata || {},
        officerReview: inspection.officerReview || {},
        comparison: inspection.comparison || null,
        detectedBarcodes: inspection.detectedBarcodes || [],
        creatorId: currentUser?.id || 'PS-INS-94210',
        creatorRole: currentUser?.role || 'inspector',
      },
      created_by: currentUser?.name ? `${currentUser.name} (${currentUser.id})` : (inspection.createdBy || 'Legal Metrology Officer'),
      created_at: inspection.createdAt || new Date().toISOString(),
    };

    const { data: savedInspection, error: inspError } = await supabase
      .from('inspections')
      .upsert(inspectionPayload, { onConflict: 'id' })
      .select()
      .single();

    if (inspError) {
      console.warn('Supabase inspection upsert error:', inspError);
      return { success: false, error: inspError };
    }

    const violations = inspection.compliance?.violations || [];
    if (violations.length > 0) {
      await supabase.from('violations').delete().eq('inspection_id', inspection.id);

      const violationRows = violations.map((v) => ({
        inspection_id: inspection.id,
        rule_name: v.rule || 'Legal Metrology Rule',
        rule_clause: v.clause || '',
        severity: v.severity || 'WARNING',
        violation_desc: v.desc || v.description || '',
        officer_recommendation: v.action || v.recommendation || '',
        status: v.status || 'PENDING',
      }));

      await supabase.from('violations').insert(violationRows);
    }

    const frames = inspection.frameResults || [];
    if (frames.length > 0) {
      await supabase.from('evidence_frames').delete().eq('inspection_id', inspection.id);

      const frameRows = frames.map((f) => ({
        inspection_id: inspection.id,
        frame_number: f.frameNumber || 1,
        timestamp_sec: parseFloat(f.timestamp) || 0,
        image_url: f.imageUrl || f.s3Url || f.dataUrl || null,
        sharpness_score: f.sharpness || 0,
        ocr_confidence: f.ocrConfidence || 0,
        detected_text: f.declarations ? JSON.stringify(f.declarations) : '',
      }));

      await supabase.from('evidence_frames').insert(frameRows);
    }

    console.log('✅ Inspection successfully synced to Supabase Cloud:', inspection.id);
    return { success: true, data: savedInspection };
  } catch (err) {
    console.error('Failed to sync inspection to Supabase:', err);
    return { success: false, error: err };
  }
}

/**
 * Fetch inspections from Supabase Cloud Database strictly for the logged-in user.
 */
export async function fetchInspectionsFromCloud(forUser = null) {
  if (!supabase) return [];
  const currentUser = forUser || getLoggedInUser();
  if (!currentUser) return [];

  try {
    let query = supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false });

    // Non-admin users only fetch their own records from Supabase cloud
    if (currentUser.role !== 'administrator' && currentUser.role !== 'admin') {
      query = query.ilike('created_by', `%${currentUser.id}%`);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row) => {
      const extra = row.detected_declarations || {};
      return {
        id: row.id,
        productName: row.product_name,
        brand: row.brand,
        status: row.status,
        productImage: row.product_image_url,
        createdAt: row.created_at,
        creatorId: extra.creatorId || currentUser.id,
        createdBy: row.created_by,
        ocrText: extra.ocrText || '',
        ocrConfidence: extra.ocrConfidence || 0,
        declarations: extra.declarations || [],
        compliance: extra.compliance || {
          status: row.status,
          score: row.compliance_score || 0,
          violations: [],
        },
        detectedBarcodes: extra.detectedBarcodes || (row.barcode ? [row.barcode] : []),
        scanMetadata: extra.scanMetadata || {},
        officerReview: extra.officerReview || {
          notes: '',
          decisions: {},
          completed: false,
          completedAt: null,
        },
        comparison: extra.comparison || null,
      };
    });
  } catch (err) {
    console.warn('Supabase fetch query failed:', err);
    return [];
  }
}

/**
 * Delete an inspection from Supabase Cloud Database.
 */
export async function deleteInspectionFromCloud(id) {
  if (!supabase || !id) return;
  try {
    await supabase.from('inspections').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete error:', err);
  }
}

/**
 * Delete multiple inspections from Supabase Cloud Database in batch.
 */
export async function deleteInspectionsFromCloud(ids) {
  if (!supabase || !ids || ids.length === 0) return;
  try {
    await supabase.from('inspections').delete().in('id', ids);
  } catch (err) {
    console.warn('Supabase bulk delete error:', err);
  }
}

/**
 * Update an inspection in Supabase Cloud Database.
 */
export async function updateInspectionInCloud(id, updates) {
  if (!supabase || !id) return;
  try {
    const patch = {};
    if (updates.status) patch.status = updates.status;
    if (updates.productName) patch.product_name = updates.productName;
    if (updates.productImage) patch.product_image_url = updates.productImage;
    if (updates.officerReview) {
      const { data: existing } = await supabase
        .from('inspections')
        .select('detected_declarations')
        .eq('id', id)
        .single();

      if (existing) {
        patch.detected_declarations = {
          ...(existing.detected_declarations || {}),
          officerReview: updates.officerReview,
        };
      }
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from('inspections').update(patch).eq('id', id);
    }
  } catch (err) {
    console.warn('Supabase update error:', err);
  }
}

/**
 * Authentication Helpers
 */
export const authService = {
  async signInWithEmail(email, password) {
    if (!supabase) return { error: null };
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signUpWithEmail(email, password, metadata = {}) {
    if (!supabase) return { error: null };
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
  },

  async resetPassword(email) {
    if (!supabase) return { data: {}, error: null };
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    });
  },

  async signOut() {
    try {
      localStorage.removeItem('packsure_officer');
    } catch {}
    if (!supabase) return { error: null };
    return await supabase.auth.signOut();
  },

  async getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  },

  async getUser() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  },
};
