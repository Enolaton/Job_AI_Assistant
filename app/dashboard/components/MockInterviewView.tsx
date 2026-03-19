import React from 'react';
import { Mic, Brain, Target, Zap } from 'lucide-react';

export default function MockInterviewView() {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 max-w-4xl mx-auto text-center">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Mic size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-4">AI 모의 면접 시뮬레이터</h1>
            <p className="text-slate-500 mb-8 text-lg">
                실제 면접처럼 음성으로 답변해 보세요. AI가 당신의 답변을 분석하여 <br />
                논리 구성, 전달력, 핵심 키워드 포함 여부를 평가합니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-blue-600 mb-3 flex justify-center"><Brain size={24} /></div>
                    <h3 className="font-bold text-slate-900 mb-1">실시간 음성 분석</h3>
                    <p className="text-xs text-slate-500">답변 속도와 톤을 실시간으로 분석합니다.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-purple-600 mb-3 flex justify-center"><Target size={24} /></div>
                    <h3 className="font-bold text-slate-900 mb-1">STARI 평가</h3>
                    <p className="text-xs text-slate-500">논리적인 구조로 답변했는지 체크합니다.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-orange-600 mb-3 flex justify-center"><Zap size={24} /></div>
                    <h3 className="font-bold text-slate-900 mb-1">즉각적인 피드백</h3>
                    <p className="text-xs text-slate-500">면접 종료 직후 상세 리포트를 생성합니다.</p>
                </div>
            </div>
            <button className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">
                면접 시작하기
            </button>
        </div>
    );
}
