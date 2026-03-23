// app/page.tsx
import Link from 'next/link';
import { FileSearch, Brain, Edit3 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <div className="text-center max-w-xl space-y-6">
        <div className="inline-flex items-center justify-center h-12 w-12 bg-blue-600 text-white rounded-xl mb-2">
          <Brain size={24} />
        </div>
        <h1 className="text-5xl font-bold text-slate-900 tracking-tight">Bunny</h1>
        <p className="text-lg text-slate-500 leading-relaxed">
          채용 공고 분석부터 자기소개서 작성, AI 평가까지.<br/>
          취업 준비의 모든 과정을 하나의 플랫폼에서.
        </p>
        
        <div className="pt-4">
          <Link href="/login">
            <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium text-base hover:bg-blue-700 transition-colors shadow-sm">
              시작하기
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-10 text-left">
          <div className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
            <FileSearch size={20} className="text-blue-600 mb-2.5" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">공고 분석</h3>
            <p className="text-xs text-slate-500 leading-relaxed">채용 공고 URL만 입력하면 AI가 직무를 파악합니다.</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
            <Edit3 size={20} className="text-blue-600 mb-2.5" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">자기소개서</h3>
            <p className="text-xs text-slate-500 leading-relaxed">경험 기반 맞춤형 자기소개서를 작성하고 평가받으세요.</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
            <Brain size={20} className="text-blue-600 mb-2.5" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">AI 면접</h3>
            <p className="text-xs text-slate-500 leading-relaxed">실전 면접을 시뮬레이션하고 피드백을 받으세요.</p>
          </div>
        </div>
      </div>
      
      <footer className="absolute bottom-8 text-slate-400 text-xs">
        © 2026 Bunny — Data-Driven Career Intelligence
      </footer>
    </div>
  );
}