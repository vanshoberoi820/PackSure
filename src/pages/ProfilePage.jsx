import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Moon,
  Globe,
  Info,
  LogOut,
  Award,
  ChevronRight,
  Bot,
  BadgeCheck,
  ShoppingBag,
  ShieldAlert,
} from 'lucide-react';
import { getStats, getVoiceAssistantEnabled, setVoiceAssistantEnabled, resetStorageSession } from '../utils/storage';
import { getLoggedInUser, authService } from '../utils/supabaseClient';
import logo from '../assets/logo.png';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, compliant: 0, violations: 0, needsReview: 0 });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [userProfile, setUserProfile] = useState(() => getLoggedInUser());

  useEffect(() => {
    const loadStats = async () => {
      const data = await getStats();
      if (data) setStats(data);
      setVoiceEnabled(getVoiceAssistantEnabled());
      setUserProfile(getLoggedInUser());
    };
    loadStats();
  }, []);

  const handleToggleVoice = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    setVoiceAssistantEnabled(nextVal);
  };

  const successRate =
    stats.total > 0
      ? Math.round(((stats.compliant + stats.violations) / stats.total) * 100)
      : 100;

  const handleLogout = async () => {
    resetStorageSession();
    await authService.signOut();
    navigate('/login', { replace: true });
  };

  const getRoleIcon = () => {
    switch (userProfile.role?.toLowerCase()) {
      case 'consumer':
        return ShoppingBag;
      case 'admin':
        return ShieldAlert;
      default:
        return BadgeCheck;
    }
  };

  const RoleIcon = getRoleIcon();

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-nav">
      {/* Profile Header */}
      <div className="bg-white pt-8 pb-6 px-4 border-b border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4 mb-5">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg border-2 border-slate-100 overflow-hidden p-2">
            <img src={logo} alt="PackSure Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">
              {userProfile.name || 'Legal Metrology Officer'}
            </h1>
            <p className="text-slate-500 text-xs truncate mb-1">
              {userProfile.roleLabel || 'Legal Metrology Inspector'}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-blue-200/60 font-mono">
                <RoleIcon className="w-3 h-3 mr-1 text-blue-600" />
                {userProfile.id || 'PS-INS-00001'}
              </span>
              <span className="text-[10px] text-slate-400 capitalize px-1.5 py-0.5 bg-slate-100 rounded-md">
                {userProfile.authProvider || 'Verified'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="text-center">
            <div className="text-xl font-bold text-slate-800">{stats.total > 0 ? stats.total : '—'}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Inspections</div>
          </div>
          <div className="text-center border-l border-r border-slate-200">
            <div className="text-xl font-bold text-slate-800">{stats.total > 0 ? `${successRate}%` : '—'}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Verified Rate</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-emerald-600">{stats.compliant > 0 ? stats.compliant : '—'}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Compliant</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Settings Group */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">App Settings</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Voice Assistant Toggle */}
            <div
              onClick={handleToggleVoice}
              className="flex items-center justify-between p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-3">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-800 font-semibold text-sm block">Voice Assistant</span>
                  <span className="text-[11px] text-slate-400 block">Announce 4 core metrics on scan</span>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full relative transition-colors ${voiceEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-all ${voiceEnabled ? 'right-1' : 'left-1'}`}></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-b border-slate-50">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-slate-400 mr-3" />
                <span className="text-slate-700 font-medium text-sm">Notifications</span>
              </div>
              <div className="w-11 h-6 bg-blue-500 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm"></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-b border-slate-50">
              <div className="flex items-center">
                <Moon className="w-5 h-5 text-slate-400 mr-3" />
                <span className="text-slate-700 font-medium text-sm">Dark Mode</span>
              </div>
              <div className="w-11 h-6 bg-slate-200 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm"></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center">
                <Globe className="w-5 h-5 text-slate-400 mr-3" />
                <span className="text-slate-700 font-medium text-sm">Language</span>
              </div>
              <div className="flex items-center text-slate-400">
                <span className="text-sm mr-2 text-slate-500">English / Hindi</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center">
                <Info className="w-5 h-5 text-slate-400 mr-3" />
                <span className="text-slate-700 font-medium">About PackSure</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Legal Resource */}
        <div
          className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white shadow-md flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center">
            <div className="bg-white/20 p-2 rounded-lg mr-3">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Legal Metrology Rules</h3>
              <p className="text-blue-100 text-xs">Packaged Commodities 2011</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70" />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center p-3.5 bg-white text-rose-600 font-bold rounded-xl shadow-sm border border-rose-100 hover:bg-rose-50 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out ({userProfile.id})
        </button>

        <div className="text-center pb-6">
          <p className="text-xs text-slate-400 font-mono">PackSure v1.0.0 — SIH 2026 Prototype</p>
        </div>
      </div>
    </div>
  );
}
