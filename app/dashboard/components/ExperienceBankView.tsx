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

    // 컴포넌트 마운트 시 기존 데이터 불러오기 (데이터 증발 방지 로직)
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
        <div className="h-full overflow-y-auto custom-scrollbar px-6 md:px-12 py-10">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col gap-2 mb-10 text-left">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-full">Inventory</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        경험 뱅크 <span className="text-blue-600">.</span>
                    </h1>
                    <p className="text-slate-500 text-lg max-w-2xl leading-relaxed">
                        나만의 실무 경험을 체계적으로 기록하세요. AI가 당신의 이력서와 포트폴리오에서 <span className="font-bold text-slate-700 underline decoration-blue-500/30">핵심 역량</span>을 찾아드립니다.
                    </p>
                </div>

                <div className="space-y-12">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 p-10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full -mr-24 -mt-24 transition-transform group-hover:scale-110 duration-700"></div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-600 text-white rounded-2xl">
                                        <FileText size={24} />
                                    </div>
                                    내 이력서, 포트폴리오
                                </h2>
                                <div className="flex items-center gap-3 text-sm font-bold px-4 py-2 bg-slate-100 text-slate-500 rounded-xl">
                                    업로드 현황 <span className="text-blue-600">{uploadedCount}/2</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="group/card">
                                    <DocumentUploadCard 
                                        type="RESUME"
                                        title="이력서"
                                        documents={documents}
                                        handleUpload={handleUpload}
                                        handleDelete={handleDelete}
                                        uploadingType={uploadingType}
                                    />
                                </div>
                                <div className="group/card">
                                    <DocumentUploadCard 
                                        type="PORTFOLIO"
                                        title="포트폴리오"
                                        documents={documents}
                                        handleUpload={handleUpload}
                                        handleDelete={handleDelete}
                                        uploadingType={uploadingType}
                                    />
                                </div>
                            </div>
                            <p className="mt-6 text-sm text-slate-400 font-medium text-center italic">
                                이력서 및 포트폴리오는 <span className="text-blue-500 font-bold">PDF 형식</span>으로 업로드 해주세요
                            </p>

                            <div className="mt-8 pt-8 border-t border-slate-100 bg-slate-50/30 -mx-10 -mb-10 p-10 flex flex-col items-center">
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || documents.length === 0}
                                    className={`relative group flex items-center justify-center gap-4 px-16 py-6 rounded-3xl font-black text-2xl transition-all shadow-2xl active:scale-95 ${isAnalyzing || documents.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600 hover:-translate-y-1 shadow-blue-500/30'}`}
                                >
                                    {isAnalyzing ? (
                                        <><Loader2 size={32} className="animate-spin" /> <span>내 경험 분석 중</span></>
                                    ) : (
                                        <>
                                            <Brain size={32} className="text-blue-400" />
                                            <span>내 경험 분석</span>
                                            <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                                        </>
                                    )}
                                    {!isAnalyzing && documents.length > 0 && (
                                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full animate-ping"></div>
                                    )}
                                </button>
                                <p className="mt-6 text-sm font-bold text-slate-400 flex items-center gap-2 uppercase tracking-tight">
                                    <CheckCircle2 size={18} className="text-green-500" /> 모든 데이터는 암호화되어 보호됩니다
                                </p>
                            </div>
                        </div>
                    </div>

                    {experiences.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                                        <Brain size={28} />
                                    </div>
                                    심층 분석 리포트 <span className="text-blue-600 text-base font-bold bg-blue-50 px-4 py-1.5 rounded-full">{experiences.length}개 유효 경험</span>
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className={`p-5 cursor-pointer flex ${isOpen ? 'min-h-[130px] h-auto items-start' : 'h-[130px] items-center'}`} onClick={() => setIsOpen(!isOpen)}>
                <div className="flex justify-between items-center w-full gap-4 h-full">
                    <div className="flex flex-col gap-2 flex-1 min-w-0 justify-center">
                        <div className="flex items-center gap-2 flex-nowrap overflow-hidden">
                            {displayTags.slice(0, 4).map(tag => (
                                <span key={tag} className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full whitespace-nowrap shrink-0">{tag}</span>
                            ))}
                        </div>
                        <h3 className={`text-base md:text-lg font-bold text-slate-900 ${isOpen ? '' : 'line-clamp-2'}`}>{experience.title}</h3>
                    </div>
                    <div className="flex h-full items-center">
                        <ChevronRight size={20} className={`text-slate-400 shrink-0 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                </div>
            </div>
            {isOpen && (
                <div className="px-6 pb-6 pt-2 bg-slate-50/30 border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <StarISection label="Situation" content={experience.situation} color="text-blue-600" bgColor="bg-blue-50" />
                        <StarISection label="Task" content={experience.task} color="text-purple-600" bgColor="bg-purple-50" />
                        <StarISection label="Action" content={experience.action} color="text-orange-600" bgColor="bg-orange-50" />
                        <StarISection label="Result" content={experience.result} color="text-green-600" bgColor="bg-green-50" />
                    </div>
                    <div className="p-4 bg-slate-900 rounded-xl">
                        <div className="flex items-center gap-2 text-white font-bold text-xs mb-2">
                            <Zap size={14} className="text-yellow-400 fill-yellow-400" /> Insight
                        </div>
                        <p className="text-slate-300 text-sm italic leading-relaxed">
                            "{experience.insight}"
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.();
                            }}
                            className="text-xs text-slate-400 hover:text-red-500 font-medium flex items-center gap-1"
                        >
                            <Trash2 size={14} /> 삭제하기
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
            <div className={`text-[10px] font-black uppercase tracking-widest ${color} ${bgColor} w-fit px-2 py-0.5 rounded`}>
                {label}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed pl-1">
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
        <div className="border border-slate-200 rounded-xl p-5 flex flex-col hover:border-blue-400 transition-colors bg-slate-50 relative group min-h-[220px]">
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
                {categoryDocs.length > 0 ? <CheckCircle2 size={24} className="text-green-500" /> : <FileText size={24} className="text-slate-300" />}
            </div>

            <div className="flex-1 space-y-3 mb-6 overflow-y-auto max-h-[120px] custom-scrollbar pr-1">
                {categoryDocs.length > 0 ? (
                    categoryDocs.map((doc) => (
                        <div key={doc.id} className="flex flex-col gap-1 p-2 bg-white rounded-lg border border-slate-100 shadow-sm group/item">
                            <div className="flex justify-between items-start gap-2">
                                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline font-medium truncate flex-1 flex items-center gap-1">
                                    <LinkIcon size={12} /> {doc.fileName}
                                </a>
                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                                    title="삭제"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-slate-400 italic">등록된 파일이 없습니다.</p>
                )}
            </div>

            <input type="file" ref={fileRef} className="hidden" onChange={(e) => handleUpload(e, type)} accept=".pdf,.doc,.docx,.hwp" />

            <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingType === type}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm mt-auto"
            >
                {uploadingType === type ? <Loader2 size={18} className="animate-spin text-blue-600" /> : <PlusCircle size={18} className="text-blue-600" />}
                파일 추가하기
            </button>
        </div>
    );
}
