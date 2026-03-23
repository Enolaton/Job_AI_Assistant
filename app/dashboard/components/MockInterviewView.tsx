import React from 'react';
import { Mic, Brain, Target, Zap } from 'lucide-react';

export default function MockInterviewView() {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 max-w-3xl mx-auto text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-5">
                <Mic size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">AI 모의 면접</h1>
            <p className="text-slate-500 mb-8 text-sm max-w-md leading-relaxed">
                실제 면접처럼 음성으로 답변하고, AI가 답변의
                논리 구성, 전달력, 핵심 키워드 포함 여부를 평가합니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10">
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <Brain size={20} className="text-blue-600 mb-2" />
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">실시간 음성 분석</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">답변 속도와 톤을 실시간으로 분석합니다.</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <Target size={20} className="text-purple-600 mb-2" />
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">STARI 평가</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">논리적인 구조로 답변했는지 체크합니다.</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <Zap size={20} className="text-amber-600 mb-2" />
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">즉각적인 피드백</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">면접 종료 직후 상세 리포트를 생성합니다.</p>
                </div>
            </div>
            <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors">
                면접 시작하기
            </button>
            <p className="mt-4 text-xs text-slate-400">곧 출시 예정입니다</p>
        </div>
    );
}
