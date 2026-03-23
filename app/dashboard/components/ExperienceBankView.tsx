import React, { useState, useRef } from 'react';
import { 
    FileText, 
    PlusCircle, 
    Brain, 
    ArrowRight, 
    CheckCircle2, 
    ChevronRight, 
    Trash2, 
    Link as LinkIcon, 
    Loader2,
    Zap,
    Star
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Experience } from '../dashboard.types';

interface ExperienceBankViewProps {}

export default function ExperienceBankView({}: ExperienceBankViewProps) {
    const [documents, setDocuments] = useState<any[]>([]);
    const [experiences, setExperiences] = useState<any[]>([]);
    const [uploadingType, setUploadingType] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/bank');
                const data = await res.json();
                if (data.documents) setDocuments(data.documents);
                if (data.experiences) setExperiences(data.experiences);
            } catch (error) {
                console.error('[bank] Failed to fetch initial data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingType(type);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        try {
            const res = await fetch('/api/bank', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            
            if (res.status === 400) {
                toast.error(data.reason || '지원 서류 형식이 아닙니다. 올바른 이력서 또는 포트폴리오를 업로드해 주세요.', {
                    duration: 5000,
                    icon: '⚠️'
                });
                return;
            }

            if (data.id) {
                setDocuments(prev => [...prev.filter(d => d.type !== type), { ...data, type }]);
                toast.success(`${type === 'RESUME' ? '이력서' : '포트폴리오'}가 업로드되었습니다.`);
            }
        } catch (error) {
            console.error(error);
            toast.error('업로드 실패');
        } finally {
            setUploadingType(null);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/bank?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setDocuments(prev => prev.filter(d => d.id !== id));
                toast.success('삭제되었습니다.');
            }
        } catch (error) {
            console.error(error);
            toast.error('삭제 실패');
        }
    };

    const handleDeleteExperience = async (id: number) => {
        try {
            const res = await fetch(`/api/bank?expId=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setExperiences(prev => prev.filter(exp => exp.id !== id));
                toast.success('경험 기록이 삭제되었습니다.');
            }
        } catch (error) {
            console.error(error);
            toast.error('삭제 실패');
        }
    };

    const handleAnalyze = async () => {
        if (documents.length === 0) {
            toast.error('먼저 서류를 업로드해 주세요.');
            return;
        }

        setIsAnalyzing(true);
        try {
            const res = await fetch(`/api/bank?t=${Date.now()}`, { method: 'PUT' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.experiences && data.experiences.length > 0) {
                setExperiences(data.experiences);
                toast.success(`${data.experiences.length}개의 새로운 경험이 분석되었습니다!`);
            } else {
                toast.error('추가로 분석된 새로운 경험이 없습니다.');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(`분석 중 오류 발생: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const uploadedCount = documents.length;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar px-8 py-8">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">경험 뱅크</h1>
                    <p className="text-slate-500 text-sm">
                        이력서와 포트폴리오를 업로드하면 AI가 핵심 경험을 자동으로 추출합니다.
                    </p>
                </div>

                {/* Upload Section */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <FileText size={18} className="text-blue-600" />
                            서류 업로드
                        </h2>
                        <span className="text-xs text-slate-400 font-medium">
                            {uploadedCount}/2 업로드
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DocumentUploadCard 
                            type="RESUME"
                            title="이력서"
                            documents={documents}
                            handleUpload={handleUpload}
                            handleDelete={handleDelete}
                            uploadingType={uploadingType}
                        />
                        <DocumentUploadCard 
                            type="PORTFOLIO"
                            title="포트폴리오"
                            documents={documents}
                            handleUpload={handleUpload}
                            handleDelete={handleDelete}
                            uploadingType={uploadingType}
                        />
                    </div>
                    <p className="text-xs text-slate-400 text-center">
                        PDF 형식의 파일을 업로드해 주세요
                    </p>

                    <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || documents.length === 0}
                            className={`flex items-center gap-2.5 px-8 py-3 rounded-lg font-medium text-sm transition-all ${isAnalyzing || documents.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {isAnalyzing ? (
                                <><Loader2 size={18} className="animate-spin" /> 경험 분석 중...</>
                            ) : (
                                <><Brain size={18} /> 경험 분석하기 <ArrowRight size={16} /></>
                            )}
                        </button>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-500" /> 모든 데이터는 암호화되어 보호됩니다
                        </p>
                    </div>
                </div>

                {/* Analysis Results */}
                {experiences.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                <Brain size={18} className="text-blue-600" />
                                분석 결과
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{experiences.length}개 경험</span>
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            {experiences.map((exp, idx) => (
                                <ExperienceCard
                                    key={exp.id || `exp-${idx}`}
                                    experience={exp}
                                    onDelete={() => exp.id && handleDeleteExperience(exp.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ExperienceCard({ experience, onDelete }: { experience: Experience, onDelete?: () => void }) {
    const [isOpen, setIsOpen] = useState(false);

    let displayTags: string[] = [];
    try {
        if (typeof experience.tags === 'string') {
            displayTags = JSON.parse(experience.tags);
        } else if (Array.isArray(experience.tags)) {
            displayTags = experience.tags;
        }
    } catch (e) {
        displayTags = [];
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all hover:shadow-sm">
            <div className={`p-4 cursor-pointer flex ${isOpen ? 'items-start' : 'items-center'}`} onClick={() => setIsOpen(!isOpen)}>
                <div className="flex justify-between items-center w-full gap-3">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
                            {displayTags.slice(0, 4).map(tag => (
                                <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded whitespace-nowrap shrink-0">{tag}</span>
                            ))}
                        </div>
                        <h3 className={`text-sm font-semibold text-slate-900 ${isOpen ? '' : 'line-clamp-2'}`}>{experience.title}</h3>
                    </div>
                    <ChevronRight size={16} className={`text-slate-400 shrink-0 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <StarISection label="Situation" content={experience.situation} color="text-blue-600" bgColor="bg-blue-50" />
                        <StarISection label="Task" content={experience.task} color="text-purple-600" bgColor="bg-purple-50" />
                        <StarISection label="Action" content={experience.action} color="text-amber-600" bgColor="bg-amber-50" />
                        <StarISection label="Result" content={experience.result} color="text-emerald-600" bgColor="bg-emerald-50" />
                    </div>
                    <div className="p-3.5 bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-1.5 text-white text-xs font-medium mb-1.5">
                            <Zap size={12} className="text-amber-400 fill-amber-400" /> Insight
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">
                            "{experience.insight}"
                        </p>
                    </div>
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.();
                            }}
                            className="text-xs text-slate-400 hover:text-red-500 font-medium flex items-center gap-1"
                        >
                            <Trash2 size={12} /> 삭제
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StarISection({ label, content, color, bgColor }: { label: string, content: string, color: string, bgColor: string }) {
    return (
        <div className="space-y-1">
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${color} ${bgColor} w-fit px-1.5 py-0.5 rounded`}>
                {label}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pl-0.5">
                {content}
            </p>
        </div>
    );
}

function DocumentUploadCard({ 
    type, 
    title, 
    documents, 
    handleUpload, 
    handleDelete, 
    uploadingType 
}: { 
    type: string, 
    title: string, 
    documents: any[], 
    handleUpload: (e: React.ChangeEvent<HTMLInputElement>, type: string) => void, 
    handleDelete: (id: string) => void, 
    uploadingType: string | null 
}) {
    const categoryDocs = documents.filter(d => d.type === type);
    const fileRef = useRef<HTMLInputElement>(null);

    return (
        <div className="border border-slate-200 rounded-lg p-4 flex flex-col hover:border-blue-300 transition-colors bg-slate-50/50 min-h-[180px]">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
                {categoryDocs.length > 0 ? <CheckCircle2 size={18} className="text-emerald-500" /> : <FileText size={18} className="text-slate-300" />}
            </div>

            <div className="flex-1 space-y-2 mb-4 overflow-y-auto max-h-[100px] custom-scrollbar pr-1">
                {categoryDocs.length > 0 ? (
                    categoryDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-100">
                            <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-medium truncate flex items-center gap-1">
                                <LinkIcon size={11} /> {doc.fileName}
                            </a>
                            <button
                                onClick={() => handleDelete(doc.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-slate-400">등록된 파일이 없습니다.</p>
                )}
            </div>

            <input type="file" ref={fileRef} className="hidden" onChange={(e) => handleUpload(e, type)} accept=".pdf,.doc,.docx,.hwp" />

            <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingType === type}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors mt-auto"
            >
                {uploadingType === type ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <PlusCircle size={14} className="text-blue-600" />}
                파일 추가하기
            </button>
        </div>
    );
}
