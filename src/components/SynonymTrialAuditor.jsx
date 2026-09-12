import { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  ArrowRight,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import {
  matchSynonymScore,
  findBestFieldForPhrase,
  STATUTORY_SYNONYMS,
} from '../engine/synonymEngine';

export default function SynonymTrialAuditor({ declarations = [], rawOcrText = '' }) {
  const [testInput, setTestInput] = useState('mf by');
  const [selectedField, setSelectedField] = useState('manufacturer');
  const [activeTab, setActiveTab] = useState('trial'); // 'trial' | 'scanned_audit'

  // Quick preset phrases to test
  const quickTestCases = [
    { label: 'mf by', text: 'mf by ABC Beverages Ltd.', target: 'manufacturer' },
    { label: 'mfd & pkd by', text: 'mfd & pkd by Western Pack Pvt Ltd', target: 'manufacturer' },
    { label: 'manufacturer by', text: 'manufacturer by Global Foods', target: 'manufacturer' },
    { label: 'brand marketed by', text: 'Brand owned & marketed by', target: 'manufacturer' },
    { label: 'pkd by', text: 'pkd by Om Packaging Ltd', target: 'packer' },
    { label: 'net wt', text: 'Net Wt. 500 g', target: 'netQuantity' },
    { label: 'mrp', text: 'M.R.P. Rs 99.00 (Incl. of all taxes)', target: 'mrp' },
    { label: 'use by', text: 'Use by 28/04/2027', target: 'bestBefore' },
    { label: 'mfg dt', text: 'Mfg Dt: 12/2026', target: 'manufacturingDate' },
  ];

  // Real-time local synonym calculation
  const liveMatch = useMemo(() => {
    if (!testInput.trim()) return null;
    const directTargetMatch = selectedField
      ? matchSynonymScore(testInput, selectedField)
      : null;
    const bestOverall = findBestFieldForPhrase(testInput);

    return {
      targetMatch: directTargetMatch,
      bestOverall,
    };
  }, [testInput, selectedField]);

  return (
    <div className="card p-5 border border-primary-100/80 bg-gradient-to-br from-white via-white to-primary-50/20 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-50 border border-primary-200/60 flex items-center justify-center text-primary-600 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 leading-tight">
              Statutory Synonym & Word Trial Model
            </h3>
            <p className="text-[11px] text-gray-500 font-medium">
              Analyze packaging abbreviations (e.g. &quot;mf by&quot;) & compare with Rule 6 synonyms
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex bg-gray-100/80 p-0.5 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveTab('trial')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'trial'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Live Word Trial
          </button>
          <button
            onClick={() => setActiveTab('scanned_audit')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'scanned_audit'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Scanned Declarations Audit ({declarations.length})
          </button>
        </div>
      </div>

      {activeTab === 'trial' ? (
        <div className="space-y-4 pt-1">
          {/* Quick preset buttons */}
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5 tracking-wider">
              Quick Test Presets (Click to Trial)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickTestCases.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTestInput(item.text);
                    setSelectedField(item.target);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    testInput === item.text
                      ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive input box */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => {
                    setTestInput(e.target.value);
                  }}
                  placeholder="Enter word / phrase (e.g. 'mf by', 'mfd & pkd by')..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              <div>
                <select
                  value={selectedField}
                  onChange={(e) => {
                    setSelectedField(e.target.value);
                  }}
                  className="w-full py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  {Object.entries(STATUTORY_SYNONYMS).map(([fKey, fVal]) => (
                    <option key={fKey} value={fKey}>
                      {fVal.canonical} ({fVal.rule})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Live Analysis Output Card */}
          {liveMatch && (
            <div className="bg-white rounded-xl border border-gray-200/90 p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      liveMatch.bestOverall.score >= 80
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : liveMatch.bestOverall.score >= 50
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {liveMatch.bestOverall.score}%
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">
                      {liveMatch.bestOverall.canonical || 'No statutory match'}
                    </h4>
                    <p className="text-[10px] text-gray-500">
                      {liveMatch.bestOverall.rule || 'Unmatched'} • Match Type:{' '}
                      <span className="font-semibold text-gray-700 font-mono">
                        {liveMatch.bestOverall.matchType}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Matched Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">
                    Detected Synonym Term
                  </span>
                  <span className="font-semibold text-gray-800">
                    &quot;{liveMatch.bestOverall.matchedSynonym || testInput}&quot;
                  </span>
                </div>

                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">
                    Target Evaluation Score
                  </span>
                  <span className="font-semibold text-gray-800">
                    {liveMatch.targetMatch?.score || 0}% for {STATUTORY_SYNONYMS[selectedField]?.canonical}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Scanned Audit List */
        <div className="space-y-2 pt-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1 tracking-wider">
            Detected Statutory Declarations & Synonym Equivalences
          </span>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {declarations.map((decl, idx) => {
              const synMatch = decl.value
                ? matchSynonymScore(decl.evidence || decl.value, decl.field)
                : null;
              const hasMatch = synMatch && synMatch.isMatch;

              return (
                <div
                  key={idx}
                  className="bg-white p-3 rounded-xl border border-gray-200/80 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{decl.label}</span>
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                        {decl.rule}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1 truncate">
                      {decl.value || <span className="italic text-gray-400">Not detected</span>}
                    </p>
                    {decl.evidence && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate font-mono">
                        Evidence: &quot;{decl.evidence}&quot;
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        decl.status === 'detected'
                          ? 'bg-emerald-100 text-emerald-800'
                          : decl.status === 'needs_review'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {decl.status === 'detected'
                        ? '100% Match'
                        : decl.status === 'needs_review'
                        ? 'Review'
                        : 'Missing'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
