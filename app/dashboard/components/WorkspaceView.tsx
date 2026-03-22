import React, { useState, useEffect } from 'react';
import {
    Edit3,
    ChevronRight,
    ArrowLeft,
    Target,
    ArrowRight,
    PlusCircle,
    Save,
    X,
    Loader2,
    Zap,
    Rocket,
    Sparkles,
    ShieldAlert,
    Briefcase,
    Settings,
    ChevronLeft,
    BarChart3,
    Search,
    CheckCircle2,
    ChevronDown,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface WorkspaceViewProps {
    onViewChange: (view: any) => void;
    onOpenCompanyReport?: (name: string, title?: string) => void;
}

type DocStatus = '작성전' | '작성중' | '작성완료' | '지원완료';

const STATUS_CONFIG: Record<DocStatus, { label: string, color: string, bg: string, border: string, icon: React.ReactNode }> = {
    '작성전': { label: '작성전', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: <Edit3 size={10} /> },
    '작성중': { label: '작성중', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: <Sparkles size={10} /> },
    '작성완료': { label: '작성완료', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 size={10} /> },
    '지원완료': { label: '지원완료', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Rocket size={10} /> },
};

export default function WorkspaceView({
    onViewChange,
    onOpenCompanyReport
}: WorkspaceViewProps) {
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null); // 문서 상태 변경 메뉴의 열림/닫힘을 관리하는 상태

    // Editor States
    const [currentDoc, setCurrentDoc] = useState<any>(null);
    const [activeTab, setActiveTab] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showEvaluation, setShowEvaluation] = useState(false);
    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
    const [isEditQuestionOpen, setIsEditQuestionOpen] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

    useEffect(() => {
        if (view === 'list') {
            fetchDocuments();
        }
        fetchJDHistory();
    }, [view]);

    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/workspace');
            const data = await res.json();
            if (data.documents) setDocuments(data.documents);
        } catch (error) {
            toast.error('문서 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchJDHistory = async () => {
        try {
            const res = await fetch('/api/analyze/jd');
            const data = await res.json();
            if (data.history) setHistory(data.history);
        } catch (error) {
            console.error('JD History Error:', error);
        }
    };

    const handleCreateNew = async () => {
        const newDoc = {
            name: '제목 없는 자기소개서',
            status: '작성전',
            tabs: ['지원 동기'],
            questions: ['지원 동기 및 포부를 작성해 주세요.'],
            contents: [''],
            charLimits: [700]
        };

        try {
            const res = await fetch('/api/workspace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDoc)
            });
            const data = await res.json();
            if (data.success) {
                toast.success('새 문서가 생성되었습니다.');
                openEditor(data.id);
            }
        } catch (error) {
            toast.error('문서 생성 중 오류가 발생했습니다.');
        }
    };

    const openEditor = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/workspace?id=${id}`);
            const data = await res.json();
            if (data.draft) {
                setCurrentDoc(data.draft);
                setLastSavedAt(new Date(data.draft.updatedAt));
                setActiveTab(0);
                setView('editor');
            }
        } catch (error) {
            toast.error('문서를 여는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteDocument = async (id: string) => {
        if (!window.confirm('이 자기소개서를 삭제하시겠습니까? 삭제된 문서는 복구할 수 없습니다.')) return;

        try {
            const res = await fetch(`/api/workspace?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                toast.success('삭제되었습니다.');
                fetchDocuments();
            } else {
                toast.error(data.error || '삭제 중 오류가 발생했습니다.');
            }
        } catch (error) {
            toast.error('삭제 중 오류가 발생했습니다.');
        }
    };

    const handleSave = async (docToSave = currentDoc, silent = false) => {
        if (!docToSave) return;
        
        // 데이터 정합성 보장: id가 있으면 업데이트 모드로 동작
        const payload = {
            ...docToSave,
            id: docToSave.id?.toString() // ID 강제 문자열 변환
        };

        try {
            const res = await fetch('/api/workspace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                if (!silent) toast.success('저장되었습니다.');
                // 서버에서 새로 생성된 ID가 있다면 업데이트
                if (data.id && (!currentDoc.id || currentDoc.id.toString().startsWith('temp-'))) {
                    setCurrentDoc({ ...currentDoc, id: data.id });
                }
                setLastSavedAt(new Date());
                fetchDocuments();
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            console.error('Save Error:', error);
            if (!silent) toast.error(error.message || '저장 중 오류가 발생했습니다.');
        }
    };

    const addTab = () => {
        if (!currentDoc) return;
        const newDoc = {
            ...currentDoc,
            tabs: [...currentDoc.tabs, '새 문항'],
            questions: [...currentDoc.questions, '문항 내용을 입력해 주세요.'],
            contents: [...currentDoc.contents, ''],
            charLimits: [...currentDoc.charLimits, 700]
        };
        setCurrentDoc(newDoc);
        setActiveTab(newDoc.tabs.length - 1);
    };

    const deleteTab = (index: number) => {
        if (!currentDoc || currentDoc.tabs.length <= 1) return;
        const newDoc = { ...currentDoc };
        newDoc.tabs.splice(index, 1);
        newDoc.questions.splice(index, 1);
        newDoc.contents.splice(index, 1);
        newDoc.charLimits.splice(index, 1);
        setCurrentDoc(newDoc);
        if (activeTab >= newDoc.tabs.length) setActiveTab(newDoc.tabs.length - 1);
    };

    const updateContent = (val: string) => {
        if (!currentDoc) return;
        const newContents = [...currentDoc.contents];
        newContents[activeTab] = val;
        setCurrentDoc({ ...currentDoc, contents: newContents });
    };

    const handleTargetLink = async (item: any, selectedRole?: any) => {
        if (!currentDoc) return;
        const updatedDoc = {
            ...currentDoc,
            companyName: item.companyName,
            jobTitle: selectedRole?.roleTitle || selectedRole?.모집직무 || selectedRole?.모집부문 || selectedRole?.직무 || selectedRole?.title || '직무 미지정',
            analysisId: item.id,
            roleId: selectedRole?.id || null
        };
        setCurrentDoc(updatedDoc);
        setIsTargetModalOpen(false);
        toast.success(`'${item.companyName}' 공고와 연결되었습니다.`);
        
        // 즉시 저장
        handleSave(updatedDoc, true);
    };

    const handleManualTarget = (company: string, job: string) => {
        if (!currentDoc) return;
        const updatedDoc = {
            ...currentDoc,
            companyName: company,
            jobTitle: job,
            analysisId: null,
            roleId: null
        };
        setCurrentDoc(updatedDoc);
        setIsTargetModalOpen(false);
        toast.success('지원 정보가 설정되었습니다.');
        
        // 즉시 저장
        handleSave(updatedDoc, true);
    };

    const handleQuickStatusChange = async (docId: string, newStatus: DocStatus) => {
        try {
            // UI 측면에서 즉시 반영
            setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus } : d));
            if (currentDoc && currentDoc.id === docId) {
                setCurrentDoc({ ...currentDoc, status: newStatus });
            }

            // [CRITICAL FIX] 전체 데이터를 보내지 않고 상태만 업데이트하도록 전용 API 호출
            // 기존 POST는 전체 덮어쓰기 로직이므로 PATCH를 통해 상태만 수정하도록 백엔드와 맞춤
            const res = await fetch('/api/workspace', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: docId, status: newStatus })
            });

            if (!res.ok) throw new Error();
            toast.success(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
            fetchDocuments(); // 목록 최종 확인
        } catch (error) {
            toast.error('상태 변경 중 오류가 발생했습니다.');
            fetchDocuments();
        } finally {
            setOpenStatusMenu(null);
        }
    };

    const handleUpdateQuestion = (data: { title: string, description: string, limit: number }) => {
        if (!currentDoc) return;
        const newTabs = [...currentDoc.tabs];
        const newQuestions = [...currentDoc.questions];
        const newLimits = [...currentDoc.charLimits];

        newTabs[activeTab] = data.title;
        newQuestions[activeTab] = data.description;
        newLimits[activeTab] = data.limit;

        setCurrentDoc({
            ...currentDoc,
            tabs: newTabs,
            questions: newQuestions,
            charLimits: newLimits
        });
        setIsEditQuestionOpen(false);
        toast.success('문항 정보가 수정되었습니다.');
    };

    // Drive List View
    if (view === 'list') {
        return (
            <div className="h-full overflow-y-auto bg-[#F8FAFC] p-8 lg:p-12 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">내 자기소개서</h2>
                            <p className="text-sm text-slate-500 mt-1">나만의 커리어 자산을 드라이브 형식으로 관리하세요.</p>
                        </div>
                        <button
                            onClick={handleCreateNew}
                            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold hover:opacity-80 transition-all shadow-xl shadow-slate-200"
                        >
                            <PlusCircle size={20} />
                            새 자기소개서 작성
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="animate-spin text-slate-300" size={40} />
                            <p className="text-slate-400 font-medium">드라이브를 불러오는 중...</p>
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="bg-white rounded-[32px] p-20 border-2 border-dashed border-slate-200 flex flex-col items-center text-center space-y-6">
                            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200">
                                <Edit3 size={40} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-slate-900">비어있는 드라이브</h3>
                                <p className="text-slate-500 max-w-sm">첫 번째 자기소개서를 만들어 나만의 커리어 자산을 쌓아보세요.</p>
                            </div>
                            <button
                                onClick={handleCreateNew}
                                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
                            >
                                지금 시작하기
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {documents.map(doc => (
                                <motion.div
                                    key={doc.id}
                                    whileHover={{ y: -4 }}
                                    onClick={() => openEditor(doc.id)}
                                    className="group bg-white border border-slate-100 p-6 rounded-[32px] text-left hover:shadow-2xl hover:shadow-slate-200 transition-all cursor-pointer space-y-4 relative"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <Edit3 size={20} />
                                        </div>
                                        {/* 프리스탠딩 라운드 팝 오버 상태 셀렉터 */}
                                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setOpenStatusMenu(openStatusMenu === doc.id ? null : doc.id)}
                                                className={cn(
                                                    "relative flex items-center gap-2 pl-7 pr-4 py-1.5 rounded-full border-2 text-[10px] font-black transition-all shadow-sm overflow-hidden",
                                                    STATUS_CONFIG[doc.status as DocStatus]?.bg || 'bg-slate-50',
                                                    STATUS_CONFIG[doc.status as DocStatus]?.color || 'text-slate-500',
                                                    STATUS_CONFIG[doc.status as DocStatus]?.border || 'border-slate-200'
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full",
                                                    doc.status === '작성전' ? "bg-slate-400" :
                                                        doc.status === '작성중' ? "bg-orange-500 animate-pulse" :
                                                            doc.status === '작성완료' ? "bg-emerald-500" : "bg-blue-500"
                                                )} />
                                                {doc.status}
                                                <ChevronDown size={10} strokeWidth={3} className={cn("transition-transform", openStatusMenu === doc.id && "rotate-180")} />
                                            </motion.button>

                                            <AnimatePresence>
                                                {openStatusMenu === doc.id && (
                                                    <>
                                                        {/* 메뉴 외부 클릭 시 닫기 위한 오버레이 */}
                                                        <div
                                                            className="fixed inset-0 z-40"
                                                            onClick={() => setOpenStatusMenu(null)}
                                                        />
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.8, y: -10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.8, y: -10 }}
                                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                            className="absolute right-0 top-full mt-2 w-36 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2rem] p-2 shadow-2xl z-50 flex flex-col gap-1 overflow-hidden"
                                                        >
                                                            {Object.keys(STATUS_CONFIG).map((status) => {
                                                                const config = STATUS_CONFIG[status as DocStatus];
                                                                const isSelected = doc.status === status;
                                                                return (
                                                                    <button
                                                                        key={status}
                                                                        onClick={() => handleQuickStatusChange(doc.id, status as DocStatus)}
                                                                        className={cn(
                                                                            "flex items-center gap-2 px-3 py-2 rounded-2xl text-[10px] font-bold transition-all text-left",
                                                                            isSelected
                                                                                ? `${config.bg} ${config.color} shadow-sm`
                                                                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                                                        )}
                                                                    >
                                                                        <div className={cn(
                                                                            "w-1.5 h-1.5 rounded-full",
                                                                            status === '작성전' ? "bg-slate-400" :
                                                                                status === '작성중' ? "bg-orange-500" :
                                                                                    status === '작성완료' ? "bg-emerald-500" : "bg-blue-500"
                                                                        )} />
                                                                        {status}
                                                                    </button>
                                                                );
                                                            })}
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                            {doc.title}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                {doc.company === '미지정' ? '개인 문서' : doc.company}
                                            </span>
                                            <span className="text-[11px] font-medium text-slate-400">
                                                {doc.job}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">최종 수정</span>
                                            <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                                                {new Date(doc.lastModified).toLocaleString('ko-KR', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: false
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                                                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                                title="삭제"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                <ArrowRight size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!currentDoc) return null;

    const activeContent = currentDoc.contents[activeTab] || '';
    const activeLimit = currentDoc.charLimits[activeTab] || 700;

    // Editor View
    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
            {/* Header */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-md z-10 transition-all">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setView('list')}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-slate-400">내 자소서</span>
                            <span className="text-slate-300">/</span>
                            <div className="relative group/title">
                                <input
                                    type="text"
                                    value={currentDoc.name}
                                    onChange={(e) => setCurrentDoc({ ...currentDoc, name: e.target.value })}
                                    className="text-lg font-black text-slate-900 outline-none bg-transparent border-b border-transparent focus:border-slate-200 transition-all"
                                />
                            </div>
                        </div>
                        <div className="h-4 w-[1px] bg-slate-200 mx-2" />
                        <button
                            onClick={() => setIsTargetModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all group"
                        >
                            <Target size={14} className="text-blue-500" />
                            <span className="text-sm font-bold text-slate-700">
                                {currentDoc.companyName ? `${currentDoc.companyName} - ${currentDoc.jobTitle}` : '지원 정보 설정'}
                            </span>
                            <Settings size={14} className="text-slate-300 group-hover:text-slate-800 transition-colors" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastSavedAt && (
                        <div className="hidden md:flex items-center gap-2 mr-4">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            <span className="text-xs font-bold text-slate-400">
                                {lastSavedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨
                            </span>
                        </div>
                    )}
                    <button
                        onClick={() => handleSave()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-2xl font-bold hover:opacity-80 transition-all shadow-lg shadow-slate-200"
                    >
                        <Save size={18} />
                        저장하기
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* 문항 사이드바 */}
                <div className="w-80 border-r border-slate-50 flex flex-col bg-slate-50/50 overflow-hidden shrink-0">
                    <div className="p-5 flex items-center justify-between border-b border-slate-100 bg-white/50">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">문항 목록</h4>
                        <button onClick={addTab} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                            <PlusCircle size={18} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {currentDoc.tabs.map((tab: string, idx: number) => (
                            <div
                                key={idx}
                                onClick={() => setActiveTab(idx)}
                                className={cn(
                                    "p-4 rounded-2xl cursor-pointer transition-all border group relative",
                                    activeTab === idx
                                        ? "bg-white border-blue-100 shadow-xl shadow-blue-50/50"
                                        : "bg-transparent border-transparent hover:bg-white/50 hover:border-slate-100"
                                )}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={cn(
                                        "text-xs font-black uppercase tracking-wider",
                                        activeTab === idx ? "text-blue-500" : "text-slate-400"
                                    )}>
                                        Question {idx + 1}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveTab(idx); setIsEditQuestionOpen(true); }}
                                            className="p-1 hover:bg-slate-50 rounded text-slate-400 hover:text-slate-900"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        {currentDoc.tabs.length > 1 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteTab(idx); }}
                                                className="p-1 hover:bg-rose-50 rounded text-slate-300 hover:text-rose-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <span className={cn(
                                    "text-sm font-bold truncate block",
                                    activeTab === idx ? "text-slate-900" : "text-slate-500"
                                )}>
                                    {tab}
                                </span>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full transition-all",
                                                (currentDoc.contents[idx]?.length || 0) > (currentDoc.charLimits[idx] || 700) ? "bg-rose-500" : "bg-emerald-500"
                                            )}
                                            style={{ width: `${Math.min(((currentDoc.contents[idx]?.length || 0) / (currentDoc.charLimits[idx] || 700)) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {currentDoc.contents[idx]?.length || 0} / {currentDoc.charLimits[idx] || 700}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 편집 본문 */}
                <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto px-12 py-16 custom-scrollbar">
                        <div className="max-w-3xl mx-auto space-y-12">
                            {/* Question Header - ui_example Style */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between group">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded-md uppercase tracking-wider">
                                                Question {activeTab + 1}
                                            </span>
                                            <button
                                                onClick={() => setIsEditQuestionOpen(true)}
                                                className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-900 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        </div>
                                        <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
                                            {currentDoc.tabs[activeTab]}
                                        </h2>
                                        <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
                                            {currentDoc.questions[activeTab]}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-1 ml-6">
                                        <div className="text-3xl font-black tracking-tighter tabular-nums">
                                            <span className={cn(
                                                activeContent.length > activeLimit ? "text-rose-500" : "text-slate-900"
                                            )}>
                                                {activeContent.length}
                                            </span>
                                            <span className="text-slate-300 mx-1">/</span>
                                            <span className="text-slate-300">{activeLimit}</span>
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Characters</p>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min((activeContent.length / activeLimit) * 100, 100)}%` }}
                                        className={cn(
                                            "h-full transition-all duration-500",
                                            activeContent.length > activeLimit ? "bg-rose-500" : "bg-emerald-500"
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="min-h-[500px] relative group">
                                <div className="absolute -left-6 top-0 bottom-0 w-[2px] bg-slate-50 group-focus-within:bg-blue-500 transition-colors" />
                                <textarea
                                    value={activeContent}
                                    onChange={(e) => updateContent(e.target.value)}
                                    placeholder="이곳에 내용을 입력하거나 AI의 도움을 받아보세요..."
                                    className="w-full min-h-[500px] text-lg leading-relaxed text-slate-700 outline-none bg-transparent resize-none placeholder:text-slate-200 font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* AI 액션 바 */}
                    <div className="h-20 border-t border-slate-50 px-12 flex items-center justify-center gap-4 bg-white shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                        <button
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-700 rounded-2xl font-bold hover:bg-blue-100 transition-all border border-blue-100"
                        >
                            <Sparkles size={18} />
                            AI 초안 생성
                        </button>
                        <button
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
                        >
                            <Zap size={18} />
                            문장 다듬기
                        </button>
                        <button
                            onClick={() => setShowEvaluation(!showEvaluation)}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-700 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-100"
                        >
                            <Rocket size={18} />
                            AI 평가 리포트
                        </button>
                    </div>
                </div>

                {/* AI 평가 패널 */}
                <AnimatePresence>
                    {showEvaluation && (
                        <motion.div
                            initial={{ x: 400 }}
                            animate={{ x: 0 }}
                            exit={{ x: 400 }}
                            className="w-96 border-l border-slate-50 bg-[#FBFBFC] flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                                <h4 className="font-black text-slate-900">AI 실시간 분석</h4>
                                <button onClick={() => setShowEvaluation(false)} className="text-slate-400 hover:text-slate-900 transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">직무 적합성</span>
                                        <span className="text-lg font-black text-blue-600">82점</span>
                                    </div>
                                    <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all" style={{ width: '82%' }} />
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        작성해주신 경험이 해당 직무의 핵심 역량인 '데이터 분석' 능력과 잘 연결되고 있습니다.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 문항 수정 모달 - ui_example Style */}
            <AnimatePresence>
                {isEditQuestionOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditQuestionOpen(false)} />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl p-8 overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-black tracking-tight text-slate-900">문항 정보 수정</h3>
                                <button onClick={() => setIsEditQuestionOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">문항 제목</label>
                                    <input
                                        type="text"
                                        defaultValue={currentDoc.tabs[activeTab]}
                                        id="edit-q-title"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900"
                                        placeholder="예: 지원 동기 및 입사 후 포부"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">상세 가이드 (설명)</label>
                                    <textarea
                                        defaultValue={currentDoc.questions[activeTab]}
                                        id="edit-q-desc"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 min-h-[120px] resize-none font-medium text-slate-600 leading-relaxed"
                                        placeholder="문항에 대한 부가 설명이나 작성 가이드를 입력하세요."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">글자 수 제한</label>
                                    <input
                                        type="number"
                                        defaultValue={currentDoc.charLimits[activeTab]}
                                        id="edit-q-limit"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-10">
                                <button
                                    onClick={() => setIsEditQuestionOpen(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => {
                                        const title = (document.getElementById('edit-q-title') as HTMLInputElement).value;
                                        const description = (document.getElementById('edit-q-desc') as HTMLTextAreaElement).value;
                                        const limit = parseInt((document.getElementById('edit-q-limit') as HTMLInputElement).value) || 700;
                                        handleUpdateQuestion({ title, description, limit });
                                    }}
                                    className="flex-1 py-4 bg-black text-white rounded-2xl font-bold hover:opacity-80 transition-all shadow-xl shadow-slate-200"
                                >
                                    저장하기
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 지원 정보 설정 모달 - Multi-step for Role Selection */}
            <TargetSelectionModal
                isOpen={isTargetModalOpen}
                onClose={() => setIsTargetModalOpen(false)}
                history={history}
                currentDoc={currentDoc}
                onSaveLink={handleTargetLink}
                onSaveManual={handleManualTarget}
            />
        </div>
    );
}

// Separate Modal for Target Selection with multi-step
function TargetSelectionModal({ isOpen, onClose, history, currentDoc, onSaveLink, onSaveManual }: any) {
    const [step, setStep] = useState<'choice' | 'analysis' | 'roles' | 'manual'>('choice');
    const [selectedItem, setSelectedItem] = useState<any>(null);

    useEffect(() => {
        if (isOpen) setStep('choice');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
                <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">지원 정보 설정</h3>
                        <p className="text-sm text-slate-500 mt-1">자기소개서 전반의 톤앤매너를 결정합니다.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {step === 'choice' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setStep('analysis')}
                                className="w-full p-6 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-3xl flex items-center gap-5 transition-all group text-left"
                            >
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <BarChart3 className="text-blue-600" size={28} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-black text-slate-900">공고 분석에서 선택</h4>
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase tracking-wider">추천</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">분석 완료된 데이터를 활용합니다.</p>
                                </div>
                            </button>
                            <button
                                onClick={() => setStep('manual')}
                                className="w-full p-6 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-3xl flex items-center gap-5 transition-all group text-left"
                            >
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <Search className="text-emerald-600" size={28} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900">직접 입력</h4>
                                    <p className="text-xs text-slate-500 mt-1">기업명과 직무를 직접 입력합니다.</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === 'analysis' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <button onClick={() => setStep('choice')} className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-slate-900 mb-2 transition-colors">
                                <ChevronLeft size={16} /> 뒤로가기
                            </button>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">최근 분석한 공고</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {history.length === 0 ? (
                                    <div className="p-10 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                                        <p className="text-xs text-slate-400 font-bold">아직 분석한 공고가 없습니다.</p>
                                    </div>
                                ) : (
                                    history.map((item: any, idx: number) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setSelectedItem(item);
                                                setStep('roles');
                                            }}
                                            className="flex items-center justify-between p-5 bg-slate-50 hover:bg-white hover:shadow-xl border border-slate-100 rounded-2xl transition-all group"
                                        >
                                            <div className="text-left">
                                                <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">[{item.companyName}] 공고</span>
                                                <p className="text-[10px] text-slate-400 mt-1">{new Date(item.createdAt).toLocaleDateString()} 분석 · 직무 {item.analysisResult?.length || 0}개</p>
                                            </div>
                                            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'roles' && selectedItem && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <button onClick={() => setStep('analysis')} className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-slate-900 mb-2 transition-colors">
                                <ChevronLeft size={16} /> 뒤로가기
                            </button>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">[{selectedItem.companyName}] 모집 직무 선택</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {selectedItem.analysisResult?.map((role: any, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => onSaveLink(selectedItem, role)}
                                        className="flex items-center justify-between p-5 bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 focus:ring-4 focus:ring-blue-100 rounded-2xl transition-all group"
                                    >
                                        <div className="text-left flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                                <Briefcase size={20} />
                                            </div>
                                            <div>
                                                <span className="text-sm font-black text-slate-900">{role.모집직무 || role.모집부문}</span>
                                                <div className="flex gap-1.5 mt-1">
                                                    {role.핵심역량?.slice(0, 2).map((s: string, i: number) => (
                                                        <span key={i} className="text-[9px] font-bold text-slate-400">#{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowRight size={18} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'manual' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <button onClick={() => setStep('choice')} className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-slate-900 mb-2 transition-colors">
                                <ChevronLeft size={16} /> 뒤로가기
                            </button>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">회사명</label>
                                    <input
                                        id="manual-company"
                                        type="text"
                                        placeholder="예: 삼성전자"
                                        defaultValue={currentDoc.companyName || ''}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">직무명</label>
                                    <input
                                        id="manual-job"
                                        type="text"
                                        placeholder="예: 마케팅"
                                        defaultValue={currentDoc.jobTitle || ''}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-sm"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const c = (document.getElementById('manual-company') as HTMLInputElement).value;
                                    const j = (document.getElementById('manual-job') as HTMLInputElement).value;
                                    if (c && j) onSaveManual(c, j);
                                    else toast.error('기업명과 직무명을 모두 입력해 주세요.');
                                }}
                                className="w-full py-5 bg-black text-white rounded-[24px] font-bold hover:opacity-80 transition-all shadow-xl shadow-slate-200 mt-4"
                            >
                                설정 완료
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
