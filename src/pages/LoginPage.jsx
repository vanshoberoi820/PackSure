import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  KeyRound,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShoppingBag,
  BadgeCheck,
  ShieldAlert,
  Fingerprint,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import QRCode from 'qrcode';
import logo from '../assets/logo.png';
import {
  authService,
  passkeyService,
  generateUniqueUserId,
  registerAccount,
  findRegisteredUser,
  saveUserProfileToCloud,
  isSupabaseConfigured,
  getRegisteredUsers,
} from '../utils/supabaseClient';

export default function LoginPage() {
  const navigate = useNavigate();

  // View Mode: 'login' | 'signup' | 'forgot_password' | 'qr_authenticator'
  const [viewMode, setViewMode] = useState('login');

  // Strict 3 Roles: 'citizen' | 'inspector' | 'administrator'
  const [selectedRole, setSelectedRole] = useState('citizen');

  // Form Fields
  const [identifier, setIdentifier] = useState(''); // Email OR Mobile OR Unique ID
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Authenticator QR Code States
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [registeredTempProfile, setRegisteredTempProfile] = useState(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 3 Strict Roles
  const roles = [
    { id: 'citizen', label: 'Citizen', icon: ShoppingBag },
    { id: 'inspector', label: 'Inspector', icon: BadgeCheck },
    { id: 'administrator', label: 'Administrator', icon: ShieldAlert },
  ];

  // Helper: Complete Login & Redirect
  const completeLogin = async (userProfile) => {
    await saveUserProfileToCloud(userProfile);
    setSuccessMsg(`Welcome, ${userProfile.name}! Redirecting...`);
    setTimeout(() => {
      navigate('/');
    }, 700);
  };

  // 1. Handle Passkey / Biometric 1-Touch Sign In
  const handlePasskeySignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setPasskeyLoading(true);

    try {
      const registeredList = getRegisteredUsers();

      if (registeredList.length === 0) {
        setErrorMsg('No registered account found on this device. Please register first.');
        setPasskeyLoading(false);
        return;
      }

      // Trigger WebAuthn Biometric / Face ID / Windows Hello
      const passkeyResult = await passkeyService.verifyPasskey();

      if (passkeyResult.success) {
        const matchedUser = registeredList.find((u) => u.role === selectedRole) || registeredList[0];
        setSuccessMsg('Passkey Authenticated! Opening dashboard...');
        await completeLogin(matchedUser);
      } else {
        setErrorMsg('Passkey authentication cancelled. You can also sign in with your password below.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Passkey verification failed.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  // 2. Handle Login with (Email OR Phone OR Unique ID) + Password
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const cleanIdentifier = identifier.trim();

      if (!cleanIdentifier) {
        setErrorMsg('Please enter your email, mobile number, or Unique ID.');
        setLoading(false);
        return;
      }

      // Check registered accounts
      const localAccount = findRegisteredUser(cleanIdentifier, password);

      if (localAccount?.error === 'invalid_password') {
        setErrorMsg('Incorrect password. Please verify and try again.');
        setLoading(false);
        return;
      }

      // Check Supabase Auth if configured and identifier is an email
      let supabaseSuccess = false;
      if (isSupabaseConfigured() && cleanIdentifier.includes('@')) {
        const { data, error } = await authService.signInWithEmail(cleanIdentifier.toLowerCase(), password);
        if (!error && data?.user) {
          supabaseSuccess = true;
        }
      }

      if (!localAccount && !supabaseSuccess) {
        setErrorMsg('No registered account found with this Email/Phone/ID. Please register first.');
        setLoading(false);
        return;
      }

      const userProfile = {
        id: localAccount?.id || generateUniqueUserId(selectedRole),
        name: localAccount?.name || cleanIdentifier.split('@')[0],
        email: localAccount?.email || (cleanIdentifier.includes('@') ? cleanIdentifier : null),
        phone: localAccount?.phone || (!cleanIdentifier.includes('@') ? cleanIdentifier : null),
        role: selectedRole,
        roleLabel: selectedRole === 'citizen' ? 'Citizen' : selectedRole === 'administrator' ? 'Administrator' : 'Legal Metrology Inspector',
        authProvider: 'password',
        createdAt: localAccount?.createdAt || new Date().toISOString(),
      };

      await completeLogin(userProfile);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Registration (Email OR Phone Optional)
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanEmail && !cleanPhone) {
      setErrorMsg('Please provide either an Email Address or Mobile Number (or both).');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      // Check if already registered
      const existing = (cleanEmail && findRegisteredUser(cleanEmail)) || (cleanPhone && findRegisteredUser(cleanPhone));
      if (existing) {
        setErrorMsg('An account with this email or mobile already exists. Please sign in.');
        setLoading(false);
        return;
      }

      // Generate Unique ID silently in background
      const assignedUniqueId = generateUniqueUserId(selectedRole);

      // Register with Supabase Auth if email provided
      if (isSupabaseConfigured() && cleanEmail) {
        await authService.signUpWithEmail(cleanEmail, password, {
          full_name: fullName,
          role: selectedRole,
          unique_id: assignedUniqueId,
          phone: cleanPhone,
        });
      }

      const userProfile = {
        id: assignedUniqueId,
        name: fullName.trim(),
        email: cleanEmail || null,
        phone: cleanPhone || null,
        password: password,
        role: selectedRole,
        roleLabel: selectedRole === 'citizen' ? 'Citizen' : selectedRole === 'administrator' ? 'Administrator' : 'Legal Metrology Inspector',
        passkeyEnabled: true,
        authProvider: 'registration',
        createdAt: new Date().toISOString(),
      };

      // Save to local registry and sync to Supabase
      registerAccount(userProfile);
      await saveUserProfileToCloud(userProfile);

      // Generate visual QR code for Authenticator App
      const userLabel = cleanEmail || cleanPhone || assignedUniqueId;
      const secret = Math.random().toString(36).substring(2, 12).toUpperCase() + 'PS26';
      setSecretKey(secret);

      const totpUri = `otpauth://totp/PackSure:${encodeURIComponent(userLabel)}?secret=${secret}&issuer=PackSure`;
      const qrData = await QRCode.toDataURL(totpUri, {
        width: 220,
        margin: 2,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      });

      setQrCodeUrl(qrData);
      setRegisteredTempProfile(userProfile);
      setLoading(false);

      // Show Optional QR Authenticator Step
      setViewMode('qr_authenticator');
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
      setLoading(false);
    }
  };

  // Copy secret key helper
  const handleCopyKey = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // 4. Handle Forgot Password
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const target = identifier.trim().toLowerCase();
      const existing = findRegisteredUser(target);
      if (!existing) {
        setErrorMsg('No registered account found with this email/phone.');
        setLoading(false);
        return;
      }

      if (isSupabaseConfigured() && target.includes('@')) {
        await authService.resetPassword(target);
      }
      setSuccessMsg(`Password reset instructions sent to ${target}!`);
      setTimeout(() => {
        setViewMode('login');
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to send reset instructions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 via-primary-700 to-primary-900 flex flex-col justify-between selection:bg-primary-500 selection:text-white">
      
      {/* Top Header */}
      <div className="w-full max-w-md mx-auto px-6 pt-10 pb-4 text-center">
        {/* Pure Logo without borders */}
        <img
          src={logo}
          alt="PackSure Logo"
          className="h-16 w-auto object-contain mx-auto mb-2 drop-shadow-md"
        />
        
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          PackSure
        </h1>
        <p className="text-primary-100 text-xs mt-1 font-medium">
          Smart Packaging Compliance & Verification Portal
        </p>
      </div>

      {/* Main Card Container Matching Dashboard Theme */}
      <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl flex-1 flex flex-col justify-between">
        <div>
          {/* ──────────────── 1. PORTAL ACCESS MODE (Citizen, Inspector, Administrator) ──────────────── */}
          <div className="mb-5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2 text-center">
              Select Portal Access Mode
            </span>

            <div className="grid grid-cols-3 gap-2">
              {roles.map((r) => {
                const IconComponent = r.icon;
                const isSelected = selectedRole === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(r.id);
                      setErrorMsg('');
                    }}
                    className={`py-2.5 px-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 font-bold text-xs ${
                      isSelected
                        ? 'bg-primary-50 border-primary-600 text-primary-700 ring-2 ring-primary-500/20 shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ──────────────── 2. SIGN IN VIEW (Email OR Phone OR Unique ID) ──────────────── */}
          {viewMode === 'login' && (
            <div className="space-y-4">
              
              {/* Optional 1-Touch Passkey / Biometric Authenticator Button */}
              <button
                type="button"
                disabled={passkeyLoading || loading}
                onClick={handlePasskeySignIn}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2.5 text-sm transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {passkeyLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 text-primary-200" />
                    <span>1-Touch Passkey / Biometric Sign In</span>
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-3 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                  Or Sign In With Password
                </span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              {/* Single Flexible Input Form: Email, Phone OR Unique ID */}
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                    Email, Mobile Number, or Unique ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. 9876543210 or name@email.com"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                    <User className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('forgot_password');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-[11px] text-primary-600 hover:text-primary-700 font-semibold"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm mt-1 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Sign In as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
                    </>
                  )}
                </button>
              </form>

              {/* Toggle to Registration */}
              <div className="pt-2 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-500">
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('signup');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-primary-600 hover:text-primary-700 font-bold underline"
                  >
                    Register New Account
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ──────────────── 3. NEW REGISTRATION (Email OR Phone Optional) ──────────────── */}
          {viewMode === 'signup' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                  Full Profile Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                      Email Address
                    </label>
                    <span className="text-[9px] text-gray-400 font-medium">(Optional if phone given)</span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                      Mobile Number
                    </label>
                    <span className="text-[9px] text-gray-400 font-medium">(Optional if email given)</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-2 shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account ({selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)})</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('login');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-primary-600 hover:text-primary-700 font-bold underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* ──────────────── 4. OPTIONAL AUTHENTICATOR QR CODE SCREEN ──────────────── */}
          {viewMode === 'qr_authenticator' && (
            <div className="space-y-4 text-center">
              <div className="inline-flex p-3 bg-primary-50 rounded-2xl border border-primary-100 text-primary-700 mx-auto">
                <ShieldCheck className="w-8 h-8 text-primary-600" />
              </div>

              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Link Authenticator App
                </h2>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Scan this QR code with <b>Google Authenticator</b>, <b>Microsoft Authenticator</b>, or your phone Camera (Optional).
                </p>
              </div>

              {/* Visual Scannable QR Code */}
              {qrCodeUrl && (
                <div className="p-3 bg-white border-2 border-dashed border-primary-200 rounded-2xl inline-block shadow-sm">
                  <img src={qrCodeUrl} alt="Authenticator QR Code" className="w-44 h-44 mx-auto rounded-lg" />
                </div>
              )}

              {/* Secret Key with Copy */}
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                <div className="text-left font-mono">
                  <span className="text-[10px] text-gray-400 block font-sans">Secret Setup Key:</span>
                  <span className="font-bold text-gray-800 tracking-wider">{secretKey}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 flex items-center gap-1 transition-all"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Action Buttons: Optional Skip or Done */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => completeLogin(registeredTempProfile)}
                  className="btn-primary shadow-md shadow-primary-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done & Open Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => completeLogin(registeredTempProfile)}
                  className="w-full py-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Skip for now (I will setup later)
                </button>
              </div>
            </div>
          )}

          {/* ──────────────── 5. FORGOT PASSWORD ──────────────── */}
          {viewMode === 'forgot_password' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-amber-100">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Reset Account Password</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Enter your registered email address or mobile number to receive password recovery instructions.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                    Registered Email or Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. name@email.com or 9876543210"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary shadow-md shadow-primary-500/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Send Reset Instructions
                    </>
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setViewMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full py-2 text-center text-xs text-gray-500 hover:text-gray-800 transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center border-t border-gray-100 pt-3">
          <p className="text-[11px] text-gray-400">
            Legal Metrology (Packaged Commodities) Rules, 2011 • SIH 2026
          </p>
        </div>
      </div>
    </div>
  );
}
