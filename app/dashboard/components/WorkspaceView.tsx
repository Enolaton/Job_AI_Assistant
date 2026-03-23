import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    ArrowRight,
    Search,
    Filter,
    Rocket,
    BrainCircuit,
    Sparkles,
    Target,
    Briefcase,
    Smile,
    RotateCcw,
    Trash2,
    Calendar,
    Users,
    CheckCircle2,
    Clock,
    FileText,
    Settings,
    Layout,
    Plus,
    X,
    MessageCircle,
    ChevronDown,
    Save,
    Pencil,
    Edit3,
    MoreHorizontal,
    Maximize2,
    History,
    FileSearch,
    PlusCircle,
    Clipboard,
    BarChart3,
    ArrowUpRight,
    Loader2,
    Zap
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
    const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);

    // Editor States
    const [currentDoc, setCurrentDoc] = useState<any>(null);
    const [activeTab, setActiveTab] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showEvaluation, setShowEvaluation] = useState(false);
    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
    const [isEditQuestionOpen, setIsEditQuestionOpen] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [evaluationResult, setEvaluationResult] = useState<any>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);

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
        setEvaluationResult(null);
        setShowEvaluation(false);
        const newDoc = {
            name: '제목 없는 자기소개서',
            status: '작성전',
            tabs: ['지원 동기'],
            questions: ['지원 동기 및 포부를 작성해 주세요'],
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
                setEvaluationResult(data.draft.evaluationResult || null);
                setShowEvaluation(false);
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

        const payload = {
            ...docToSave,
            id: docToSave.id?.toString(),
            evaluationResult: docToSave.evaluationResult || null
        };

        try {
            const res = await fetch('/api/workspace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
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
            tabs: [...currentDoc.tabs, '문항 내용을 입력해 주세요'],
            questions: [...currentDoc.questions, '문항 내용을 입력해 주세요'],
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
        handleSave(updatedDoc, true);
    };

    const handleQuickStatusChange = async (docId: string, newStatus: DocStatus) => {
        try {
            setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus } : d));
            if (currentDoc && currentDoc.id === docId) {
                setCurrentDoc({ ...currentDoc, status: newStatus });
            }
            const res = await fetch('/api/workspace', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: docId, status: newStatus })
            });
            if (!res.ok) throw new Error();
            toast.success(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
            fetchDocuments();
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
        newTabs[activeTab] = data.description; // 동기화
        newQuestions[activeTab] = data.description;
        newLimits[activeTab] = data.limit;
        const updatedDoc = {
            ...currentDoc,
            tabs: newTabs,
            questions: newQuestions,
            charLimits: newLimits
        };
        setCurrentDoc(updatedDoc);
        setIsEditQuestionOpen(false);
        toast.success('문항 정보가 수정되었습니다.');
        handleSave(updatedDoc, true);
    };

    const handleGenerateDraft = async () => {
        if (!currentDoc.companyName || currentDoc.companyName === '미지정') {
            toast.error('지원 정보를 먼저 설정해 주세요.');
            setIsTargetModalOpen(true);
            return;
        }
        setIsGenerating(true);
        try {
            const res = await fetch('/api/workspace/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selfIntroId: currentDoc.id,
                    activeTabIndex: activeTab
                })
            });
            const data = await res.json();
            if (data.draft) {
                const newContents = [...currentDoc.contents];
                newContents[activeTab] = data.draft;
                setCurrentDoc({ ...currentDoc, contents: newContents });
                toast.success('AI 초안이 생성되었습니다.');
            } else {
                throw new Error(data.error || '생성 실패');
            }
        } catch (error: any) {
            toast.error(error.message || 'AI 생성 중 오류가 발생했습니다.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleEvaluate = async (force = false) => {
        if (!activeContent.trim()) {
            toast.error('내용을 먼저 입력해 주세요.');
            return;
        }

        // 이미 결과가 있고 강제 재평가가 아니라면 결과창만 노출
        if (evaluationResult && !force) {
            setShowEvaluation(true);
            setTimeout(() => {
                document.getElementById('evaluation-report')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
            return;
        }

        setIsEvaluating(true);
        setShowEvaluation(true);
        try {
            const res = await fetch('/api/workspace/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selfIntroId: currentDoc.id,
                    activeTabIndex: activeTab,
                    currentAnswer: activeContent
                })
            });
            const data = await res.json();
            if (data.success) {
                setEvaluationResult(data);
                toast.success('평가 리포트가 완성되었습니다.');
                
                // 완성된 리포트를 DB에 즉시 저장
                if (currentDoc) {
                    const updatedDoc = { ...currentDoc, evaluationResult: data };
                    setCurrentDoc(updatedDoc);
                    handleSave(updatedDoc, true);
                }

                setTimeout(() => {
                    document.getElementById('evaluation-report')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 100);
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast.error(error.message || 'AI 평가 중 오류가 발생했습니다.');
        } finally {
            setIsEvaluating(false);
        }
    };

    if (view === 'list') {
        return (
            <div className="h-full overflow-y-auto bg-slate-50 p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">내 자기소개서</h2>
                            <p className="text-sm text-slate-500 mt-1">자기소개서를 작성하고 관리하세요.</p>
                        </div>
                        <button
                            onClick={handleCreateNew}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
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
                        <div className="bg-white rounded-xl p-16 border-2 border-dashed border-slate-200 flex flex-col items-center text-center space-y-5">
                            <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300">
                                <Edit3 size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-slate-900">비어있는 드라이브</h3>
                                <p className="text-sm text-slate-500 max-w-sm">첫 번째 자기소개서를 만들어 보세요.</p>
                            </div>
                            <button
                                onClick={handleCreateNew}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
                            >
                                지금 시작하기
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {documents.map(doc => (
                                <motion.div
                                    key={doc.id}
                                    whileHover={{ y: -4 }}
                                    onClick={() => openEditor(doc.id)}
                                    className="group bg-white border border-slate-200 p-5 rounded-xl text-left hover:shadow-md hover:border-blue-300 transition-all cursor-pointer space-y-3 relative"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <Edit3 size={16} />
                                        </div>
                                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setOpenStatusMenu(openStatusMenu === doc.id ? null : doc.id)}
                                                className={cn(
                                                    "relative flex items-center gap-2 pl-6 pr-3 py-1 rounded-full border text-[10px] font-medium transition-all overflow-hidden",
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
                                                        <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenu(null)} />
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.8, y: -10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.8, y: -10 }}
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
                                                                            isSelected ? `${config.bg} ${config.color} shadow-sm` : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                                                        )}
                                                                    >
                                                                        <div className={cn(
                                                                            "w-1.5 h-1.5 rounded-full",
                                                                            status === '작성전' ? "bg-slate-400" : status === '작성중' ? "bg-orange-500" : status === '작성완료' ? "bg-emerald-500" : "bg-blue-500"
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
                                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                            {doc.name || doc.title || '제목 없는 자기소개서'}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                                {(!doc.companyName || doc.companyName === '미지정') ? '개인 문서' : doc.companyName}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                {doc.jobTitle || doc.job || '직무 미지정'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 mb-0.5">최종 수정</span>
                                            <span className="text-[11px] text-slate-500 tabular-nums">
                                                {new Date(doc.lastModified).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                                                className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                            ><Trash2 size={14} /></button>
                                            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all"><ArrowRight size={12} /></div>
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

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
            <div className="h-14 border-b border-slate-200 flex items-center justify-between px-5 shrink-0 bg-white z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft size={20} /></button>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 mr-1 pt-0.5"><span className="text-[11px] font-medium text-slate-400">DRIVE</span><span className="text-slate-300">/</span></div>
                        <div className={cn(
                            "relative flex items-center px-1 rounded-xl transition-all border",
                            isEditingTitle ? "bg-white border-blue-200 shadow-sm ring-4 ring-blue-50" : "bg-transparent border-transparent hover:bg-slate-50"
                        )}>
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={currentDoc.name}
                                onChange={(e) => setCurrentDoc({ ...currentDoc, name: e.target.value })}
                                onFocus={() => setIsEditingTitle(true)}
                                onBlur={() => {
                                    setIsEditingTitle(false);
                                    handleSave(currentDoc, true);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && titleInputRef.current?.blur()}
                                className="text-sm font-semibold text-slate-900 outline-none bg-transparent px-2.5 py-1.5 min-w-[200px]"
                            />
                            <button
                                onClick={() => isEditingTitle ? titleInputRef.current?.blur() : titleInputRef.current?.focus()}
                                className={cn(
                                    "p-1.5 rounded-md transition-all ml-0.5",
                                    isEditingTitle ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-slate-300 hover:text-slate-600 hover:bg-white"
                                )}
                                title={isEditingTitle ? "저장" : "제목 편집"}
                            >
                                {isEditingTitle ? <CheckCircle2 size={14} /> : <Edit3 size={14} />}
                            </button>
                        </div>
                        <div className="h-4 w-[1px] bg-slate-200 mx-2" />
                        <button onClick={() => setIsTargetModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 rounded-lg transition-all group/target text-slate-700">
                            <Target size={14} className="text-blue-500" />
                            <span className="text-xs font-medium">{currentDoc.companyName ? `${currentDoc.companyName} - ${currentDoc.jobTitle}` : '지원 정보 설정'}</span>
                            <Settings size={14} className="text-slate-300 group-hover/target:text-slate-800" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastSavedAt && (
                        <div className="hidden md:flex items-center gap-2 mr-4">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            <span className="text-xs font-bold text-slate-400">{lastSavedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨</span>
                        </div>
                    )}
                    <button onClick={() => handleSave()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"><Save size={16} />저장하기</button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-72 border-r border-slate-200 flex flex-col bg-slate-50/50 overflow-hidden shrink-0">
                    <div className="p-5 flex items-center justify-between border-b border-slate-100 bg-white/50">
                        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">문항 목록</h4>
                        <button onClick={addTab} className="p-1 text-slate-400 hover:text-blue-600"><PlusCircle size={18} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {currentDoc.tabs.map((tab: string, idx: number) => (
                            <div key={idx} onClick={() => setActiveTab(idx)} className={cn("p-3.5 rounded-xl cursor-pointer transition-all border group relative", activeTab === idx ? "bg-white border-blue-100 shadow-sm" : "bg-transparent border-transparent hover:bg-white/50")}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider", activeTab === idx ? "text-blue-500" : "text-slate-400")}>Q{idx + 1}</span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                        <button onClick={(e) => { e.stopPropagation(); setActiveTab(idx); setIsEditQuestionOpen(true); }} className="p-1 hover:bg-slate-50 rounded text-slate-400"><Edit3 size={14} /></button>
                                    </div>
                                </div>
                                <span className={cn("text-sm font-medium truncate block", activeTab === idx ? "text-slate-900" : "text-slate-500")}>{currentDoc.questions[idx]}</span>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn("h-full transition-all", (currentDoc.contents[idx]?.length || 0) > (currentDoc.charLimits[idx] || 700) ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${Math.min(((currentDoc.contents[idx]?.length || 0) / (currentDoc.charLimits[idx] || 700)) * 100, 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">{currentDoc.contents[idx]?.length || 0} / {currentDoc.charLimits[idx] || 700}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto px-12 py-16 custom-scrollbar scroll-smooth" id="editor-scroll-container">
                        <div className="max-w-3xl mx-auto space-y-12 pb-40">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between group">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-semibold rounded">Q{activeTab + 1}</span>
                                        </div>
                                        <h2 className="text-lg font-semibold text-slate-900 leading-relaxed max-w-2xl whitespace-pre-wrap">{currentDoc.questions[activeTab]}</h2>
                                    </div>
                                    <div className="text-right space-y-1 ml-6">
                                        <div className="text-2xl font-bold tracking-tight tabular-nums">
                                            <span className={cn(activeContent.length > activeLimit ? "text-rose-500" : "text-slate-900")}>{activeContent.length}</span>
                                            <span className="text-slate-300 mx-1">/</span>
                                            <span className="text-slate-300">{activeLimit}</span>
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-400">글자 수</p>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((activeContent.length / activeLimit) * 100, 100)}%` }} className={cn("h-full transition-all duration-500", activeContent.length > activeLimit ? "bg-rose-500" : "bg-emerald-500")} />
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

                            <AnimatePresence>
                                {showEvaluation && (
                                    <motion.div
                                        id="evaluation-report"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-12"
                                    >
                                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                                                    <Rocket size={16} />
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-900">AI 검수 리포트</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {evaluationResult && !isEvaluating && (
                                                    <button 
                                                        onClick={() => handleEvaluate(true)} 
                                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                                                    >
                                                        <RotateCcw size={12} />
                                                        다시 분석하기
                                                    </button>
                                                )}
                                                <button onClick={() => setShowEvaluation(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-all"><X size={20} /></button>
                                            </div>
                                        </div>
                                        <div className="p-6 md:p-8 space-y-8 bg-white">
                                            {isEvaluating ? (
                                                <div className="flex flex-col items-center justify-center py-12 space-y-6 opacity-40">
                                                    <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                                                    <p className="font-semibold text-slate-500">전문가 그룹이 분석 중입니다...</p>
                                                </div>
                                            ) : evaluationResult ? (
                                                <div className="space-y-8">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="bg-slate-800 rounded-xl p-6 text-white h-full flex flex-col justify-center shadow-lg shadow-slate-800/20">
                                                            <div className="flex items-center justify-between mb-6">
                                                                <span className="text-sm font-medium text-slate-400">종합 점수</span>
                                                                <span className="text-4xl font-bold text-blue-400">{Math.round(evaluationResult.summary.score * 20)}</span>
                                                            </div>
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between text-xs text-slate-400">
                                                                    <span>AI 작성 확률</span>
                                                                    <span className={evaluationResult.ai_detect.probability > 70 ? "text-rose-400" : "text-emerald-400"}>{evaluationResult.ai_detect.probability}%</span>
                                                                </div>
                                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${evaluationResult.ai_detect.probability}%` }} className={cn("h-full", evaluationResult.ai_detect.probability > 70 ? "bg-rose-500" : "bg-emerald-500")} />
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 italic leading-relaxed pt-1">※ {evaluationResult.ai_detect.reasoning}</p>
                                                            </div>
                                                        </div>

                                                        <div className="bg-slate-50 rounded-xl p-6 h-full flex flex-col justify-center border border-slate-100">
                                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-3">
                                                                <Target size={14} /> 핵심 근거
                                                            </div>
                                                            <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                                                                {evaluationResult?.summary?.reasoning || '상세 근거 내용이 시스템에 기록되지 않았습니다.'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                                                        <SimpleFeedbackCard
                                                            icon={<Briefcase size={20} />}
                                                            title="현업 팀장의 피드백"
                                                            score={evaluationResult.manager.score}
                                                            strengths={evaluationResult.manager.reasoning.strengths}
                                                            weaknesses={evaluationResult.manager.reasoning.weaknesses}
                                                        />
                                                        <SimpleFeedbackCard
                                                            icon={<Smile size={20} />}
                                                            title="인사 담당자의 시선"
                                                            score={evaluationResult.hr.score}
                                                            strengths={evaluationResult.hr.reasoning.strengths}
                                                        />
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-24 border-t border-slate-100 px-12 flex items-center justify-center gap-4 bg-white/80 backdrop-blur-xl z-20">
                        <button onClick={handleGenerateDraft} disabled={isGenerating} className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm">
                            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}AI 초안 생성
                        </button>
                        <button onClick={() => handleEvaluate()} disabled={isEvaluating} className="flex items-center gap-2.5 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-900 transition-colors disabled:opacity-50 shadow-sm">
                            {isEvaluating ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />}AI 평가 리포트
                        </button>
                    </div>
                </div>

                <EditQuestionModal
                    isOpen={isEditQuestionOpen}
                    onClose={() => setIsEditQuestionOpen(false)}
                    currentQuestion={currentDoc.questions[activeTab]}
                    currentLimit={currentDoc.charLimits[activeTab]}
                    onSave={handleUpdateQuestion}
                    onDelete={() => {
                        deleteTab(activeTab);
                        setIsEditQuestionOpen(false);
                    }}
                    tabCount={currentDoc.tabs.length}
                />

                <TargetSettingModal
                    isOpen={isTargetModalOpen}
                    onClose={() => setIsTargetModalOpen(false)}
                    currentDoc={currentDoc}
                    onSaveLink={handleTargetLink}
                    onSaveManual={handleManualTarget}
                />
            </div>
        </div>
    );
}

function SimpleFeedbackCard({ icon, title, score, strengths, weaknesses }: any) {
    return (
        <div className="space-y-4 group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-slate-800 group-hover:text-white transition-all">{icon}</div>
                    <h4 className="font-semibold text-slate-900">{title}</h4>
                </div>
                <span className="text-base font-bold text-slate-900">{Math.round(score)}</span>
            </div>
            <div className="space-y-2">
                {strengths?.slice(0, 2).map((s: string, i: number) => (
                    <div key={i} className="text-xs font-bold text-slate-600 bg-emerald-50/50 p-3 rounded-xl flex gap-3"><span className="text-emerald-500 font-black">✓</span>{s}</div>
                ))}
                {weaknesses?.slice(0, 1).map((w: string, i: number) => (
                    <div key={i} className="text-xs font-bold text-slate-400 bg-slate-50 p-3 rounded-xl flex gap-3 italic"><span className="text-rose-400 font-black">!</span>{w}</div>
                ))}
            </div>
        </div>
    );
}

function EditQuestionModal({ isOpen, onClose, currentQuestion, currentLimit, onSave, onDelete, tabCount }: any) {
    const [description, setDescription] = useState('');
    const [limit, setLimit] = useState(700);

    useEffect(() => {
        if (isOpen) {
            setDescription(currentQuestion || '');
            setLimit(currentLimit || 700);
        }
    }, [isOpen, currentQuestion, currentLimit]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">문항 정보 수정</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500 ml-0.5">문항 내용 (질문)</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full h-32 p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none text-sm text-slate-700" placeholder="지원 동기 및 포부를 작성해 주세요." />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500 ml-0.5">글자 수 제한</label>
                        <div className="flex items-center gap-4">
                            <input type="number" value={limit} onChange={(e) => setLimit(parseInt(e.target.value))} className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-slate-900" />
                            <span className="text-slate-400 font-bold">Characters</span>
                        </div>
                    </div>
                </div>
                <div className="p-8 bg-slate-50 flex gap-4">
                    <div className="flex-1" title={tabCount <= 1 ? '최소 1개의 문항이 있어야 합니다' : undefined}>
                        <button 
                            onClick={onDelete} 
                            disabled={tabCount <= 1}
                            className="w-full h-full bg-white border border-rose-200 text-rose-600 rounded-xl font-medium text-sm hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            문항 삭제
                        </button>
                    </div>
                    <button onClick={() => onSave({ title: description.substring(0, 15), description, limit })} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors">저장하기</button>
                </div>
            </motion.div>
        </div>
    );
}

function TargetSettingModal({ isOpen, onClose, currentDoc, onSaveLink, onSaveManual }: any) {
    const [mode, setMode] = useState<'link' | 'manual'>('link');
    const [history, setHistory] = useState<any[]>([]);
    const [companyName, setCompanyName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen]);

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/analyze/jd');
            const data = await res.json();
            if (data.history) setHistory(data.history);
        } catch (error) {
            console.error('JD History Error:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div><h3 className="text-lg font-bold text-slate-900">지원 정보 설정</h3><p className="text-sm text-slate-400">어떤 기업과 직무를 목표로 하시나요?</p></div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><X size={20} /></button>
                </div>
                <div className="flex border-b border-slate-50 shrink-0">
                    <button onClick={() => setMode('link')} className={cn("flex-1 py-3 text-xs font-medium tracking-wide transition-all", mode === 'link' ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30" : "text-slate-400 hover:text-slate-600")}>분석된 공고 연결</button>
                    <button onClick={() => setMode('manual')} className={cn("flex-1 py-3 text-xs font-medium tracking-wide transition-all", mode === 'manual' ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30" : "text-slate-400 hover:text-slate-600")}>직접 입력</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {mode === 'link' ? (
                        <div className="space-y-4">
                            {history.length === 0 ? (
                                <div className="py-12 text-center space-y-4 opacity-50"><FileSearch size={40} className="mx-auto text-slate-300" /><p className="text-slate-500 font-bold">분석된 공고 내역이 없습니다.</p></div>
                            ) : (
                                history.map((item) => (
                                    <div key={item.id} className="space-y-2">
                                        <div
                                            className={cn(
                                                "p-6 border rounded-3xl transition-all cursor-pointer group",
                                                expandedItem === item.id ? "bg-blue-50/30 border-blue-200 shadow-sm" : "border-slate-100 hover:border-blue-100 hover:bg-white"
                                            )}
                                            onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                                                        <Briefcase size={20} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{item.companyName}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-medium text-slate-400">{item.industry || 'IT/Service'}</span>
                                                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                                            <p className="text-xs text-blue-500 font-medium">{(item.roles || item.analysisResult || item.job_positions || []).length}개의 모집 직무</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronDown size={18} className={cn("text-slate-300 transition-transform", expandedItem === item.id && "rotate-180")} />
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {expandedItem === item.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="grid grid-cols-1 gap-2 pt-2 px-2">
                                                        {(item.roles || item.analysisResult || item.job_positions || []).map((role: any, idx: number) => {
                                                            const displayTitle = role.roleTitle || role.모집직무 || role.모집부문 || role.직무 || role.title || role.job_title || '직무명 없음';
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => onSaveLink(item, role)}
                                                                    className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between group/role cursor-pointer shadow-sm hover:shadow-md"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full opacity-40" />
                                                                        <span className="text-sm font-bold text-slate-700 group-hover/role:text-blue-600 transition-colors leading-tight">
                                                                            {displayTitle}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-medium text-slate-300 opacity-0 group-hover/role:opacity-100 transition-opacity">선택</span>
                                                                        <ArrowRight size={14} className="text-slate-300 group-hover/role:text-blue-600 transition-all" />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-2"><label className="text-xs font-medium text-slate-500 ml-0.5">기업명</label><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-900 text-sm" placeholder="예: 카카오" /></div>
                            <div className="space-y-2"><label className="text-xs font-medium text-slate-500 ml-0.5">희망 직무</label><input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-900 text-sm" placeholder="예: 프론트엔드 개발자" /></div>
                            <button onClick={() => onSaveManual(companyName, jobTitle)} disabled={!companyName || !jobTitle} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-30">설정 완료</button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
