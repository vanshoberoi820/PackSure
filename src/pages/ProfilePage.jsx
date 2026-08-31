import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, Bell, Moon, Globe, Info, LogOut, Shield, Award, ChevronRight } from 'lucide-react';
import { getStats } from '../utils/storage';
import logo from '../assets/logo.png';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, compliant: 0, violations: 0, needsReview: 0 });

  useEffect(() => {
    const loadStats = async () => {
      const data = await getStats();
      if (data) setStats(data);
    };
    loadStats();
  }, []);

  const successRate = stats.total > 0 
    ? Math.round(((stats.compliant + stats.violations) / stats.total) * 100) 
    : 100; // 100% success if no inspections, or 0% depending on interpretation

  const handleLogout = () => {
    // In a real app, clear auth tokens here
    navigate('/login', { replace: true });
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-nav">
      {/* Profile Header */}
      <div className="bg-white pt-8 pb-6 px-4 border-b border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-blue-50 overflow-hidden p-2">
            <img src={logo} alt="PackSure Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Rajesh Kumar</h1>
            <p className="text-slate-500 text-sm mb-1">Legal Metrology Inspector</p>
            <div className="inline-flex items-center bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-semibold border border-indigo-100">
              <Shield className="w-3 h-3 mr-1" />
              Grade-II Officer
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="text-center">
            <div className="text-xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Inspections</div>
          </div>
          <div className="text-center border-l border-r border-slate-200">
            <div className="text-xl font-bold text-slate-800">{successRate}%</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Success Rate</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-slate-800">3 yrs</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Experience</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Settings Group */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">App Settings</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-50">
              <div className="flex items-center">
                <Bell className="w-5 h-5 text-slate-400 mr-3" />
                <span className="text-slate-700 font-medium">Notifications</span>
              </div>
              <div className="w-11 h-6 bg-blue-500 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border-b border-slate-50">
              <div className="flex items-center">
                <Moon className="w-5 h-5 text-slate-400 mr-3" />
                <span className="text-slate-700 font-medium">Dark Mode</span>
              </div>
              <div className="w-11 h-6 bg-slate-200 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm"></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center">
                <Globe className="w-5 h-5 text-slate-400 mr-3" />
                <span className="text-slate-700 font-medium">Language</span>
              </div>
              <div className="flex items-center text-slate-400">
                <span className="text-sm mr-2 text-slate-500">English</span>
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
              <h3 className="font-bold">Legal Metrology Rules</h3>
              <p className="text-blue-100 text-sm">Packaged Commodities 2011</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70" />
        </div>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center p-4 bg-white text-red-600 font-bold rounded-xl shadow-sm border border-red-50 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Log Out
        </button>
        
        <div className="text-center pb-6">
          <p className="text-xs text-slate-400 font-mono">PackSure v1.0.0 — SIH 2026 Prototype</p>
        </div>
      </div>
    </div>
  );
}
