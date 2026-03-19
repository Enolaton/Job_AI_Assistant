import React, { useState, useEffect, useMemo } from 'react';
import { 
    FileSearch, 
    Link as LinkIcon, 
    Loader2, 
    ArrowRight, 
    Star, 
    Database, 
    Trash2, 
    ChevronRight, 
    ArrowLeft, 
    Target,
    CheckCircle2,
    Diamond,
    BarChart3,
    Edit3,
    Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CompanyAnalysisViewProps {
    jdUrl: string;
    setJdUrl: (url: string) => void;
    isAnalyzing: boolean;
    onAnalyze: () => void;
    analysisResult: any;
    setAnalysisResult: (result: any) => void;
    analysisResultId?: number | null;
    setAnalysisResultId?: (id: number | null) => void;
    onNavigateToWorkspace: () => void;
    onOpenCompanyReport: (name: string, title?: string, force?: boolean) => void;
}

export default function CompanyAnalysisView({
    jdUrl,
    setJdUrl,
    isAnalyzing,
    onAnalyze,
    analysisResult,
    setAnalysisResult,
    analysisResultId,
    setAnalysisResultId,
    onNavigateToWorkspace,
    onOpenCompanyReport
}: CompanyAnalysisViewProps) {
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/analyze/jd');
            const data = await res.json();
            if (data.history) setHistory(data.history);
        } catch (error) {
            console.error('Failed to fetch history', error);
        }
    };

    const cleanCompanyName = (name: string) => {
        if (!name) return '';
        return name.replace(/\( ?주 ?\)|주식회사|㈜|\( ?유 ?\)|유한회사|\( ?사 ?\)|사단법인|\( ?재 ?\)|재단법인|\( ?의 ?\)|의료법인/g, '').trim();
    };

    const getSiteName = (url: string) => {
        if (!url) return '공고';
        if (url.includes('saramin.co.kr')) return '사람인';
        if (url.includes('jobkorea.co.kr')) return '잡코리아';
        if (url.includes('wanted.co.kr')) return '원티드';
        if (url.includes('rememberapp.co.kr')) return '리멤버';
        if (url.includes('blindhire.co.kr')) return '블라인드 하이어';
        return '기타 사이트';
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const handleDeleteHistory = async (id: number, companyName: string) => {
        const cleanedName = cleanCompanyName(companyName);
        if (!confirm(`[${cleanedName}] 채용 공고를 삭제하시겠습니까?`)) return;
        try {
            const res = await fetch(`/api/analyze/jd?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setHistory(prev => prev.filter(item => item.id !== id));
            } else {
                alert('삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
        }
    };

    const handleRestoreHistory = (item: any) => {
        setJdUrl('');
        if (item.analysisResult) {
            setAnalysisResult(item.analysisResult);
            if (setAnalysisResultId && item.id) {
                setAnalysisResultId(item.id);
            }
        }
    };

    const favoriteJobs = useMemo(() => {
        return history.flatMap(item => {
            if (Array.isArray(item.analysisResult)) {
                return item.analysisResult
                    .map((job: any, index: number) => ({
                        ...job,
                        parentJobAnalysisId: item.id,
                        parentJdUrl: item.jdUrl,
                        originalIndex: index,
                        createdAt: item.createdAt,
                    }))
                    .filter((job: any) => job.isFavorite);
            }
            return [];
        });
    }, [history]);

    const handleRestoreFavorite = (job: any) => {
        const parentHistoryItem = history.find(h => h.id === job.parentJobAnalysisId);
        if (parentHistoryItem) {
            handleRestoreHistory(parentHistoryItem);
            setTimeout(() => setSelectedJob(job), 100);
        }
    };

    const handleRemoveJobFromCurrentResult = async (e: React.MouseEvent, indexToRemove: number) => {
        e.stopPropagation();
        if (!confirm('해당 직무를 삭제하시겠습니까?')) return;

        const remainingJobs = analysisResult.filter((_: any, i: number) => i !== indexToRemove);
        setAnalysisResult(remainingJobs.length > 0 ? remainingJobs : null);

        if (analysisResultId) {
            if (remainingJobs.length > 0) {
                setHistory(prev => prev.map(item => item.id === analysisResultId ? { ...item, analysisResult: remainingJobs } : item));
            } else {
                setHistory(prev => prev.filter(item => item.id !== analysisResultId));
                setAnalysisResultId(null);
            }

            try {
                await fetch('/api/analyze/jd', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: analysisResultId, remainingJobs })
                });
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleToggleFavorite = async (e: React.MouseEvent, indexToToggle: number) => {
        e.stopPropagation();

        const updatedJobs = [...analysisResult];
        updatedJobs[indexToToggle] = {
            ...updatedJobs[indexToToggle],
            isFavorite: !updatedJobs[indexToToggle].isFavorite
        };

        setAnalysisResult(updatedJobs);

        if (analysisResultId) {
            setHistory(prev => prev.map(item => item.id === analysisResultId ? { ...item, analysisResult: updatedJobs } : item));

            try {
                await fetch('/api/analyze/jd', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: analysisResultId, remainingJobs: updatedJobs })
                });
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleRemoveAllCurrentResult = async () => {
        if (!confirm('직무를 모두 삭제 하시겠습니까?')) return;

        setAnalysisResult(null);

        if (analysisResultId) {
            try {
                await fetch('/api/analyze/jd', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: analysisResultId, remainingJobs: [] })
                });

                setHistory(prev => prev.filter(item => item.id !== analysisResultId));
                setAnalysisResultId(null);
            } catch (err) {
                console.error(err);
            }
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar px-12 py-10 max-w-[1440px] mx-auto space-y-8 relative">
            <div className="text-center max-w-2xl mx-auto mb-10">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileSearch size={32} />
                </div>
                <h1 className="text-4xl font-black text-slate-900 mb-4">AI 직무 및 기업 분석</h1>
                <p className="text-slate-500 text-lg">채용 공고 URL을 입력하면, AI가 화면 속 여러 직무를 모두 찾아 핵심만 요약해 드립니다.</p>
            </div>

            <div className="max-w-5xl mx-auto">
                <div className="bg-white p-2 rounded-2xl shadow-xl border border-slate-200 flex flex-col md:flex-row gap-2">
                    <div className="flex-1 flex items-center bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 focus-within:ring-2 focus-within:ring-blue-600/30 transition-all">
                        <LinkIcon className="text-slate-400 mr-3" size={24} />
                        <input
                            className="bg-transparent border-none focus:ring-0 w-full text-slate-800 placeholder-slate-400 text-lg"
                            placeholder="채용 공고 URL을 입력하세요 (예: 사람인, 잡코리아 등)"
                            type="text"
                            value={jdUrl}
                            onChange={(e) => setJdUrl(e.target.value)}
                            disabled={isAnalyzing}
                        />
                    </div>
                    <button
                        onClick={onAnalyze}
                        disabled={isAnalyzing || !jdUrl}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap text-lg"
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                <span>AI 분석 중...</span>
                            </>
                        ) : (
                            <>
                                공고 분석하기 <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Favorite Jobs Display */}
            {!analysisResult && favoriteJobs.length > 0 && (
                <div className="w-full mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Star size={20} className="text-yellow-500 fill-yellow-500" /> 즐겨찾기 한 직무
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {favoriteJobs.map((job: any, idx: number) => (
                            <div
                                key={`fav-${job.parentJobAnalysisId}-${idx}`}
                                onClick={() => handleRestoreFavorite(job)}
                                className="bg-white border border-yellow-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer flex items-start gap-4"
                            >
                                <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl shrink-0">
                                    <Star size={20} className="fill-yellow-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-400 mb-1">{getSiteName(job.parentJdUrl)} · {formatDate(job.createdAt)}</p>
                                    <p className="text-base font-bold text-slate-900 truncate">{cleanCompanyName(job.회사명)}</p>
                                </div>
                                <div className="text-slate-300">
                                    <ChevronRight size={20} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Analysis History Display */}
            {!analysisResult && history.length > 0 && (
                <div className="w-full mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Database size={20} className="text-blue-500" /> 최근 분석한 공고
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => handleRestoreHistory(item)}
                                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex items-start gap-4"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-400 mb-1">{getSiteName(item.jdUrl)} · {formatDate(item.createdAt)}</p>
                                    <p className="text-base font-bold text-slate-900 truncate">
                                        {cleanCompanyName(item.companyName)} 채용 공고
                                        <span className="text-sm font-medium text-slate-500 ml-1">
                                            (직무 {Array.isArray(item.analysisResult) ? item.analysisResult.length : 1}개)
                                        </span>
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteHistory(item.id, item.companyName);
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <div className="text-slate-300">
                                    <ChevronRight size={20} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Analysis Results Display */}
            {analysisResult && Array.isArray(analysisResult) && (
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12 space-y-6"
                >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setAnalysisResult(null)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors mr-2"
                                title="목록으로 돌아가기"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full text-sm">
                                분석 완료
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">
                                이 공고에서 <span className="text-blue-600">{analysisResult.length}개</span>의 직무를 발견했어요!
                            </h2>
                        </div>
                        <button
                            onClick={handleRemoveAllCurrentResult}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 hover:border-red-200"
                        >
                            <Trash2 size={16} /> 전체 삭제
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {analysisResult.map((job: any, index: number) => (
                            <div
                                key={index}
                                onClick={() => setSelectedJob(job)}
                                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 hover:border-blue-400 group flex flex-col cursor-pointer relative"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="pr-4">
                                        <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg mb-2">
                                            {job.회사명 || '회사명 미상'}
                                        </span>
                                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                            {job.모집직무 || '직무 미상'}
                                        </h3>
                                        <span className="inline-block mt-2 px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                                            {job.모집부문 || '부문 미상'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleRemoveJobFromCurrentResult(e, index)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                            title="삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => handleToggleFavorite(e, index)}
                                            className={`p-2 rounded-lg transition-colors h-fit ${job.isFavorite ? 'bg-yellow-100 text-yellow-500 hover:bg-yellow-200' : 'bg-slate-50 text-slate-400 hover:bg-yellow-50 hover:text-yellow-500'}`}
                                            title="즐겨찾기"
                                        >
                                            <Star size={20} className={job.isFavorite ? 'fill-yellow-500' : ''} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 mb-6">
                                    <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                                        <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <Brain size={12} /> AI 요약
                                        </h4>
                                        <p className="text-xs text-slate-700 leading-relaxed font-medium line-clamp-3">
                                            {job.공고요약 || '공고 요약 정보를 추출 중입니다...'}
                                        </p>
                                    </div>
                                </div>

                                <div className="w-full py-3 bg-white text-blue-600 border border-blue-200 font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600">
                                    자세히 보기 <ArrowRight size={16} />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative"
                        >
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 relative">
                                <button
                                    onClick={() => setSelectedJob(null)}
                                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <XIcon />
                                </button>

                                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-black tracking-wider rounded-lg mb-3">
                                    {selectedJob.회사명 || '회사명 미상'}
                                </span>
                                <h2 className="text-2xl font-black text-slate-900 mb-4">{selectedJob.모집직무 || '직무 미상'}</h2>

                                <div className="flex flex-wrap gap-2 text-sm">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium whitespace-nowrap">
                                        <Target size={14} className="text-purple-500" /> {selectedJob.모집부문 || '부문 미상'}
                                    </div>
                                    <div className="flex items-start gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium whitespace-pre-wrap">
                                        <LocationIcon />
                                        <span className="flex-1">{selectedJob.근무지 || '근무지 미상'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium whitespace-nowrap">
                                        <CalendarIcon />
                                        {selectedJob.채용시작일 || '?'} ~ {selectedJob.채용마감일 || '?'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
                                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                                    <h4 className="text-sm font-black text-blue-900 flex items-center gap-2 mb-3">
                                        <CheckCircle2 size={18} className="text-blue-600" /> 주요 업무 (Main Tasks)
                                    </h4>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedJob.주요업무 || '내용 없음'}</p>
                                </div>

                                <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100">
                                    <h4 className="text-sm font-black text-purple-900 flex items-center gap-2 mb-3">
                                        <Star size={18} className="text-purple-600" /> 자격 요건 (Requirements)
                                    </h4>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedJob.자격요건 || '내용 없음'}</p>
                                </div>

                                <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100">
                                    <h4 className="text-sm font-black text-orange-900 flex items-center gap-2 mb-3">
                                        <Diamond size={18} className="text-orange-600" /> 우대 사항 (Preferred)
                                    </h4>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedJob.우대사항 || '내용 없음'}</p>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex gap-3">
                                <button
                                    onClick={() => onOpenCompanyReport(selectedJob.회사명, selectedJob.모집직무)}
                                    className="flex-1 py-4 border-2 border-slate-100 text-slate-700 font-bold rounded-xl hover:border-blue-200 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <BarChart3 size={18} /> 기업 분석 리포트
                                </button>
                                <button
                                    onClick={() => onNavigateToWorkspace()}
                                    className="flex-[1.5] py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
                                >
                                    <Edit3 size={18} /> 자기소개서 작성하러 가기
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Internal icons for modal
function XIcon() {
    return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
}

function LocationIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 mt-1 shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
}

function CalendarIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
