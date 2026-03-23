import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    BarChart3, 
    RefreshCw, 
    X, 
    Zap, 
    Users, 
    Newspaper, 
    ExternalLink, 
    MessageSquare, 
    Loader2,
    PieChart,
    TrendingUp,
    Briefcase as BusinessIcon
} from 'lucide-react';

interface CompanyReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    data: any;
    companyName: string;
    jobTitle: string;
    onRefresh: () => void;
}

const renderContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-slate-900 font-black">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

export default function CompanyReportModal({
    isOpen,
    onClose,
    isLoading,
    data,
    companyName,
    jobTitle,
    onRefresh
}: CompanyReportModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-600/10 text-blue-600 rounded-lg">
                                    <BarChart3 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 leading-tight">[{companyName}] 기업 분석 리포트</h2>
                                    <p className="text-xs text-slate-500 font-medium">{jobTitle}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-6">
                                    <div className="relative">
                                        <div className="w-16 h-16 border-4 border-blue-100 rounded-full animate-ping opacity-20"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 size={32} className="text-blue-600 animate-spin" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-base font-semibold text-slate-900 mb-2">AI가 기업 정보를 분석 중입니다...</h3>
                                        <p className="text-slate-500 text-sm max-w-xs mx-auto">기업 공시, 최근 뉴스, 인재상 등을 요약하여<br />최적의 자료를 생성하고 있습니다.</p>
                                    </div>
                                </div>
                            ) : data ? (
                                <div className="space-y-8 animate-in fade-in duration-700">
                                    {/* 1. 인재상 섹션 */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <h4 className="text-purple-600 font-semibold text-sm flex items-center gap-1.5">
                                                <Users size={16} /> 인재상 (Ideal Candidate)
                                            </h4>
                                            <div className="h-[1px] bg-purple-100 flex-1 ml-2"></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {Array.isArray(data.analysis?.["인재상"]) && data.analysis["인재상"].length > 0 ? (
                                                data.analysis["인재상"].map((item: any, i: number) => (
                                                    <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:bg-purple-50/30 hover:border-purple-100">
                                                        <div className="font-semibold text-sm text-slate-900 mb-2 flex items-center gap-2">
                                                            <span className="w-5 h-5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full flex items-center justify-center">{i + 1}</span>
                                                            {item.키워드}
                                                        </div>
                                                        <p className="text-sm text-slate-600 leading-relaxed">{item.내용}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="col-span-2 text-center py-4 text-slate-400 text-xs italic">인재상 데이터가 없습니다.</div>
                                            )}
                                        </div>
                                    </section>

                                    {/* 2. 조직문화 요약 */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <h4 className="text-blue-600 font-semibold text-sm flex items-center gap-1.5">
                                                <Zap size={16} className="fill-blue-600" /> 조직문화 (Culture)
                                            </h4>
                                            <div className="h-[1px] bg-blue-100 flex-1 ml-2"></div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {Array.isArray(data.analysis?.["조직문화"]) && data.analysis["조직문화"].length > 0 ? (
                                                data.analysis["조직문화"].map((item: any, i: number) => (
                                                    <div key={i} className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                                                        <div className="text-blue-900 font-semibold text-sm mb-1.5 flex items-center gap-2">
                                                            <span className="w-5 h-5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full flex items-center justify-center">{i + 1}</span>
                                                            {item.키워드}
                                                        </div>
                                                        <p className="text-sm text-slate-600 leading-relaxed">{item.내용}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-4 text-slate-400 text-xs italic">조직문화 데이터가 없습니다.</div>
                                            )}
                                        </div>
                                    </section>

                                    {/* 3. DART 기업공시 분석 섹션 */}
                                    {data.dart && (
                                        <section>
                                            <div className="flex items-center gap-2 mb-6">
                                                <h4 className="text-emerald-600 font-semibold text-sm flex items-center gap-1.5">
                                                    <BarChart3 size={16} /> DART 기업공시 분석 (AI 요약)
                                                </h4>
                                                <div className="h-[1px] bg-emerald-100 flex-1 ml-2"></div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                {/* 사업 개요 */}
                                                {data.dart.business && (
                                                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                                                                <TrendingUp size={14} />
                                                            </div>
                                                            <h5 className="text-sm font-semibold text-emerald-900">산업 내 위치 및 핵심 경쟁력</h5>
                                                        </div>
                                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{renderContent(data.dart.business)}</p>
                                                    </div>
                                                )}

                                                {/* 수익 모델 */}
                                                {data.dart.products && (
                                                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                                                                <BusinessIcon size={14} />
                                                            </div>
                                                            <h5 className="text-sm font-semibold text-indigo-900">핵심 수익 모델 (Product)</h5>
                                                        </div>
                                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{renderContent(data.dart.products)}</p>
                                                    </div>
                                                )}

                                                {/* 재무 요약 */}
                                                {data.dart.financial && (
                                                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-5">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                                                                <PieChart size={14} />
                                                            </div>
                                                            <h5 className="text-sm font-semibold text-amber-900">재무 성장성 및 안정성 ({data.dart.reportYear}년 기준)</h5>
                                                        </div>
                                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{renderContent(data.dart.financial)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    )}

                                    {/* 4. 뉴스 */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <h4 className="text-orange-600 font-semibold text-sm flex items-center gap-1.5">
                                                <Newspaper size={16} /> 기업 최신 뉴스 (AI 추천)
                                            </h4>
                                            <div className="h-[1px] bg-orange-100 flex-1 ml-2"></div>
                                        </div>
                                        <div className="space-y-3">
                                            {Array.isArray(data.news) && data.news.length > 0 ? (
                                                data.news.map((item: any, i: number) => (
                                                    <a
                                                        key={i}
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block p-4 border border-slate-100 rounded-xl hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
                                                    >
                                                        <div className="flex items-start justify-between gap-3 mb-2">
                                                            <h5 className="text-sm font-semibold text-slate-800 group-hover:text-orange-700 transition-colors line-clamp-1">{item.title}</h5>
                                                            <ExternalLink size={14} className="text-slate-300 group-hover:text-orange-400 shrink-0 mt-0.5" />
                                                        </div>
                                                        <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">{item.description}</p>
                                                        <div className="text-[11px] font-medium text-slate-400">{item.pub_date || '일자 미상'}</div>
                                                    </a>
                                                ))
                                            ) : (
                                                <div className="text-center py-8 text-slate-400 text-xs italic">최근 수집된 뉴스가 없습니다.</div>
                                            )}
                                        </div>
                                    </section>

                                    {/* 면접 질문 */}
                                    {Array.isArray(data.interviewPatterns) && data.interviewPatterns.length > 0 && (
                                        <section>
                                            <div className="flex items-center gap-2 mb-4">
                                                <h4 className="text-slate-900 font-semibold text-sm flex items-center gap-1.5">
                                                    <MessageSquare size={16} /> 기출/예상 면접 질문
                                                </h4>
                                                <div className="h-[1px] bg-slate-200 flex-1 ml-2"></div>
                                            </div>
                                            <div className="space-y-2">
                                                {data.interviewPatterns.map((q: string, i: number) => (
                                                    <div key={i} className="bg-slate-50 p-3.5 rounded-lg text-sm font-semibold text-slate-700">
                                                        Q. {q}
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-20 text-slate-400 font-sans font-medium">데이터가 없습니다.</div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
