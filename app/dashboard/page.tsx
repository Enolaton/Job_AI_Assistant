'use client';

import { useState } from 'react';

export default function Dashboard() {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (!url.includes('saramin') && !url.includes('jobkorea')) {
      alert('사람인 또는 잡코리아 URL을 입력해주세요!');
      return;
    }
    
    setIsAnalyzing(true);
    
    // 3초 뒤에 분석 완료 리포트 페이지로 이동하는 시뮬레이션
    setTimeout(() => {
      alert('기업 정보 분석 완료! 리포트 페이지로 이동합니다.');
      setIsAnalyzing(false);
      // router.push('/report'); // 나중에 리포트 페이지 만들면 연결
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl p-12 border border-slate-100">
        <div className="text-center mb-10">
          <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase">Step 02. Analysis</span>
          <h1 className="text-4xl font-black text-slate-900 mt-4 mb-2">분석할 공고를 알려주세요</h1>
          <p className="text-slate-500">채용공고 URL을 입력하면 Bunny가 기업 정보를 수집합니다.</p>
        </div>

        <div className="space-y-4">
          <input 
            type="text" 
            placeholder="예: https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=..."
            className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all text-lg shadow-inner"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isAnalyzing}
          />
          
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={`w-full py-5 rounded-2xl font-bold text-xl transition-all shadow-lg ${
              isAnalyzing 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 active:scale-[0.98]'
            }`}
          >
            {isAnalyzing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-6 w-6 text-slate-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Bunny가 데이터를 분석 중입니다...
              </span>
            ) : "리포트 생성하기"}
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Source</p>
            <p className="text-sm font-semibold text-slate-700 font-sans">DART 공시</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-400 font-bold uppercase mb-1">AI Engine</p>
            <p className="text-sm font-semibold text-slate-700 font-sans">Claude 3.5</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Target</p>
            <p className="text-sm font-semibold text-slate-700 font-sans">Company Report</p>
          </div>
        </div>
      </div>
    </div>
  );
}