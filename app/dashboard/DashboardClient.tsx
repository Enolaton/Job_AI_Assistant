'use client';

import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
    LayoutDashboard,
    Database,
    FileText,
    Settings,
    HelpCircle,
    PlusCircle,
    ChevronRight,
    Bell,
    UserCircle,
    Search,
    ArrowRight,
    ArrowLeft,
    UploadCloud,
    Link as LinkIcon,
    Folder,
    Edit3,
    TrendingUp,
    Diamond,
    CheckCircle2,
    Brain,
    Star,
    Briefcase,
    MessageSquare,
    ShieldAlert,
    Info,
    Rocket,
    Handshake,
    Bug,
    Users,
    BarChart3,
    FileSearch,
    Share2,
    Download,
    Zap,
    Target,
    Loader2,
    ChevronDown,
    LogOut,
    Mic,
    Trash2,
    Save,
    Newspaper,
    ExternalLink,
    X,
    Copy,
    RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSession, signOut } from 'next-auth/react';
import type { ViewType, Experience } from './dashboard.types';

// --- Mock Data ---
const MOCK_EXPERIENCES: Experience[] = [];

// --- Helper Functions ---
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '수정 기록 없음';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) return '방금 전';
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

const getSiteName = (url: string) => {
    if (!url) return '공고 출처';
    if (url.includes('saramin')) return '사람인';
    if (url.includes('jobkorea')) return '잡코리아';
    if (url.includes('wanted')) return '원티드';
    if (url.includes('rocketpunch')) return '로켓펀치';
    if (url.includes('jumpit')) return '점핏';
    if (url.includes('blindhire')) return '블라인드하이어';
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return '웹사이트';
    }
};

const cleanCompanyName = (name: string) => {
    if (!name) return '회사명 정보 없음';
    return name.replace(/\(.*\)/g, '').replace(/\s+$/, '');
};

export default function DashboardClient() {
    const { data: session } = useSession();
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [jdUrl, setJdUrl] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [analysisResultId, setAnalysisResultId] = useState<number | null>(null);
    const [selectedJobForWorkspace, setSelectedJobForWorkspace] = useState<any>(null);

    const handleAnalyze = async () => {
        if (!jdUrl) {
            toast.error('URL을 입력해주세요.');
            return;
        }

        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            const response = await fetch('/api/analyze/jd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: jdUrl }),
            });

            const data = await response.json();

            if (response.ok) {
                setAnalysisResult(data.result);
                if (data.id) setAnalysisResultId(data.id);
                setJdUrl(''); // 1. URL Clear after success
            } else {
                throw new Error(data.error || '분석 중 오류가 발생했습니다.');
            }
        } catch (error: any) {
            console.error('Analysis error:', error);
            toast.error(error.message || '분석에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const userName = session?.user?.name || '사용자';
    const userEmail = session?.user?.email || 'user@example.com';

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return (
                <DashboardView
                    userName={userName}
                    jdUrl={jdUrl}
                    setJdUrl={setJdUrl}
                    isAnalyzing={isAnalyzing}
                    onAnalyze={handleAnalyze}
                    analysisResult={analysisResult}
                />
            );
            case 'workspace': return (
                <WorkspaceView 
                    selectedJob={selectedJobForWorkspace} 
                    onSelectJob={setSelectedJobForWorkspace} 
                    onViewChange={setCurrentView}
                />
            );
            case 'experience': return <ExperienceBankView />;
            case 'analysis': return (
                <CompanyAnalysisView
                    jdUrl={jdUrl}
                    setJdUrl={setJdUrl}
                    isAnalyzing={isAnalyzing}
                    onAnalyze={handleAnalyze}
                    analysisResult={analysisResult}
                    setAnalysisResult={setAnalysisResult}
                    analysisResultId={analysisResultId}
                    setAnalysisResultId={setAnalysisResultId}
                    onNavigateToWorkspace={(job) => {
                        setSelectedJobForWorkspace(job);
                        setCurrentView('workspace');
                    }}
                />
            );
            case 'interview': return <MockInterviewView />;
            default: return (
                <DashboardView
                    userName={userName}
                    jdUrl={jdUrl}
                    setJdUrl={setJdUrl}
                    isAnalyzing={isAnalyzing}
                    onAnalyze={handleAnalyze}
                    analysisResult={analysisResult}
                />
            );
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Toaster position="top-right" />
            {/* Sidebar */}
            {/* Sidebar */}
            <aside className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-20'}`}>
                <div className="p-6 flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-600/10 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Brain size={24} />
                    </div>
                    {isSidebarOpen && <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">JobAI Assist</h1>}
                </div>

                <nav className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar pt-4">
                    {isSidebarOpen && <div className="px-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">메뉴</div>}
                    <NavItem icon={<LayoutDashboard size={20} />} label="대시보드" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} collapsed={!isSidebarOpen} />
                    <NavItem icon={<Database size={20} />} label="내 경험 뱅크" active={currentView === 'experience'} onClick={() => setCurrentView('experience')} collapsed={!isSidebarOpen} />
                    <NavItem icon={<FileSearch size={20} />} label="공고 분석" active={currentView === 'analysis'} onClick={() => setCurrentView('analysis')} collapsed={!isSidebarOpen} />
                    <NavItem icon={<Edit3 size={20} />} label="자기소개서" active={currentView === 'workspace'} onClick={() => setCurrentView('workspace')} collapsed={!isSidebarOpen} />
                    <NavItem icon={<Mic size={20} />} label="AI 모의 면접" active={currentView === 'interview'} onClick={() => setCurrentView('interview')} collapsed={!isSidebarOpen} />

                    <div className="pt-8">
                        {isSidebarOpen && <div className="px-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">계정</div>}
                        <NavItem icon={<Settings size={20} />} label="설정" collapsed={!isSidebarOpen} />
                        <NavItem icon={<HelpCircle size={20} />} label="고객지원" collapsed={!isSidebarOpen} />
                        <NavItem
                            icon={<LogOut size={20} />}
                            label="로그아웃"
                            collapsed={!isSidebarOpen}
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        />
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                            <UserCircle size={24} />
                        </div>
                        {isSidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{userName}</p>
                                <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>


            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                            <LayoutDashboard size={20} />
                        </button>
                        <h2 className="text-lg font-bold text-slate-900 capitalize">
                            {currentView === 'experience' ? '경험 뱅크' :
                                currentView === 'workspace' ? '자기소개서 작성' :
                                    currentView === 'analysis' ? '공고 분석' :
                                        currentView === 'interview' ? 'AI 모의 면접' : '대시보드'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        {currentView === 'workspace' && (
                            <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg mr-2 animate-pulse">
                                실시간 작성 중
                            </div>
                        )}
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                className="pl-10 pr-4 py-2 w-64 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
                                placeholder="검색..."
                                type="text"
                            />
                        </div>
                        <button className="p-2 text-slate-500 hover:text-blue-600 transition-colors relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                            <UserCircle size={20} />
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentView}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            {renderView()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}

function NavItem({ icon, label, active, onClick, collapsed, className }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, collapsed?: boolean, className?: string }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${active
                ? 'bg-blue-600/10 text-blue-600 shadow-sm'
                : className || 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                } ${collapsed ? 'justify-center px-0' : ''}`}
        >
            <span className="shrink-0">{icon}</span>
            {!collapsed && <span className="truncate">{label}</span>}
        </button>
    );
}

// --- View Components ---

function DashboardView({
    userName,
    jdUrl,
    setJdUrl,
    isAnalyzing,
    onAnalyze,
    analysisResult
}: {
    userName: string,
    jdUrl: string,
    setJdUrl: (url: string) => void,
    isAnalyzing: boolean,
    onAnalyze: () => void,
    analysisResult: any
}) {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar px-12 py-10 max-w-[1440px] mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">반가워요, {userName}님! 👋</h1>
                    <p className="text-slate-500 max-w-2xl">다음 커리어를 준비할 준비가 되셨나요? 새로운 직무를 분석하거나 경험 뱅크를 업데이트해보세요.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">원하는 기업의 직무를 심층 분석해보세요</h2>
                    <p className="text-slate-500">공고 분석 탭에서 채용 공고 URL을 입력하면, AI가 요구 역량을 추출해 드립니다.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={<Folder className="text-blue-600" />} label="내 경험 뱅크" value="24" unit="STARI 기록" badge="이번 주 +2" badgeColor="bg-green-100 text-green-700" />
                <StatCard icon={<Edit3 className="text-purple-600" />} label="진행 중인 초안" value="07" unit="개 작성 중" badge="3개 대기" badgeColor="bg-purple-100 text-purple-700" />
                <StatCard icon={<TrendingUp className="text-orange-600" />} label="시장 인사이트" value="IT 채용 12% 상승" unit="" badge="New" badgeColor="bg-orange-100 text-orange-700" isTextValue />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-900">최근 활동</h3>
                        <button className="text-sm text-blue-600 hover:underline">전체 보기</button>
                    </div>
                    <div className="space-y-4">
                        <ActivityItem icon={<FileSearch className="text-blue-600" />} title="Product Manager @ Stripe" subtitle="공고 분석 • 2시간 전" status="완료됨" statusColor="bg-green-100 text-green-800" />
                        <ActivityItem icon={<Edit3 className="text-purple-600" />} title="Senior Frontend Dev Intro" subtitle="자기소개서 초안 • 어제" status="작성 중" statusColor="bg-yellow-100 text-yellow-800" />
                        <ActivityItem icon={<PlusCircle className="text-slate-400" />} title="새 STARI 기록 추가" subtitle="경험 뱅크 • 2일 전" />
                    </div>
                </div>
                <div className="bg-gradient-to-b from-white to-blue-50 rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                    <div>
                        <div className="h-12 w-12 bg-blue-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/30">
                            <Diamond size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Pro로 업그레이드</h3>
                        <p className="text-sm text-slate-500 mb-6">무제한 직무 분석과 고도화된 AI 탐지 회피 기능을 사용해보세요.</p>
                        <ul className="space-y-3 mb-8">
                            <li className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 size={18} className="text-green-500" /> 무제한 JD 분석
                            </li>
                            <li className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 size={18} className="text-green-500" /> 고급 AI 작문
                            </li>
                            <li className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 size={18} className="text-green-500" /> PDF/Word 내보내기
                            </li>
                        </ul>
                    </div>
                    <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors">
                        요금제 보기
                    </button>
                </div>
            </div>
        </div >
    );
}


function ResultItem({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-blue-200 text-xs font-medium uppercase tracking-wider">{label}</span>
            <span className="font-semibold text-white">{value || '-'}</span>
        </div>
    );
}

function StatCard({ icon, label, value, unit, badge, badgeColor, isTextValue }: { icon: React.ReactNode, label: string, value: string, unit: string, badge?: string, badgeColor?: string, isTextValue?: boolean }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
                {badge && <span className={`${badgeColor} text-xs font-bold px-2 py-1 rounded-full`}>{badge}</span>}
            </div>
            <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">{label}</h3>
            <div className="flex items-end gap-2">
                <span className={`${isTextValue ? 'text-xl' : 'text-4xl'} font-bold text-slate-900`}>{value}</span>
                {unit && <span className="text-sm text-slate-500 mb-1.5">{unit}</span>}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50">
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                    전체 보기 <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}

function ActivityItem({ icon, title, subtitle, status, statusColor }: { icon: React.ReactNode, title: string, subtitle: string, status?: string, statusColor?: string }) {
    return (
        <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer">
            <div className="h-12 w-12 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="flex-1 min-0">
                <h4 className="text-sm font-semibold text-slate-900 truncate">{title}</h4>
                <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
            {status && (
                <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {status}
                    </span>
                </div>
            )}
        </div>
    );
}


function WorkspaceView({ selectedJob, onSelectJob, onViewChange }: { selectedJob?: any, onSelectJob: (job: any) => void, onViewChange: (view: ViewType) => void }) {
    const [drafts, setDrafts] = useState<any[]>([
        {
            id: 'draft-1',
            name: '자기소개서 1',
            tabs: ['문항 1', '문항 2', '문항 3', '문항 4'],
            questions: [
                '지원 동기 및 입사 후 포부',
                '직무 관련 프로젝트 경험',
                '팀 워크 및 협업 사례',
                '자신의 강점과 약점'
            ],
            contents: ['', '', '', ''],
            charLimits: [700, 700, 700, 700],
            status: '작성전',
            isFinal: true
        }
    ]);
    const [activeDraftId, setActiveDraftId] = useState('draft-1');
    const [activeTab, setActiveTab] = useState(0);
    const [showEvaluation, setShowEvaluation] = useState(false);
    const [isDraftGenerated, setIsDraftGenerated] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditingQuestion, setIsEditingQuestion] = useState(false);
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false); // 워크스페이스 진입 여부
    const [openStatusId, setOpenStatusId] = useState<string | null>(null); // 현재 열린 상태 드롭다운 ID

    const currentDraft = drafts.find(d => d.id === activeDraftId) || drafts[0];
    const { tabs, contents } = currentDraft;
    const companyName = selectedJob?.회사명 || '회사명';
    const jobTitle = selectedJob?.모집부문 || selectedJob?.모집직무 || '직무';
    const currentQuestionDetail = (currentDraft.questions || [])[activeTab] || '';

    const currentStrategies = [
        '해당 직무와 관련된 구체적인 프로젝트 성과를 정량적으로 기술하세요.',
        '기업의 핵심 가치(인재상)와 본인의 경험을 연결하여 적합성을 강조하세요.',
        '문제 해결 과정에서 본인의 주도적인 역할과 배운 점을 명확히 전달하세요.'
    ];

    // 선택된 공고(selectedJob) 변경 시 상태 초기화 및 데이터 로드 (Reset State & Load Data)
    React.useEffect(() => {
        if (selectedJob) {
            // 다른 공고 선택 시 이전 기업 분석 데이터가 남아있지 않도록 초기화 (Isolation)
            setCompanyReportData(null);
            
            const loadDrafts = async () => {
                setIsLoading(true);
                try {
                    const roleTitle = selectedJob.모집부문 || selectedJob.모집직무;
                    const company = selectedJob.회사명;
                    const res = await fetch(`/api/workspace?roleTitle=${encodeURIComponent(roleTitle)}&companyName=${encodeURIComponent(company)}`);
                    const data = await res.json();
                    if (data.drafts && data.drafts.length > 0) {
                        setDrafts(data.drafts);
                        setActiveDraftId(data.drafts[0].id);
                        setActiveTab(0);
                    }
                } catch (error) {
                    console.error('Failed to load drafts:', error);
                } finally {
                    setIsLoading(false);
                }
            };
            loadDrafts();
        }
    }, [selectedJob]);

    const handleSave = async () => {
        if (!selectedJob) return;

        const saveToast = toast.loading('데이터 서버 저장 중...');
        try {
            // Role identification logic needs to be robust
            const roleTitle = selectedJob.모집부문 || selectedJob.모집직무 || "전체";
            const companyName = selectedJob.회사명;

            console.log('Saving drafts for:', { companyName, roleTitle });

            const res = await fetch('/api/workspace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    drafts: drafts.map(d => ({
                        ...d,
                        // Ensure all required fields exist
                        tabs: d.tabs || ['문항 1'],
                        questions: d.questions || d.tabs?.map((t: string) => t) || ['질문'],
                        contents: d.contents || [''],
                        charLimits: d.charLimits || d.tabs?.map(() => 700) || [700],
                        status: d.status || '작성전'
                    })),
                    roleTitle,
                    companyName
                })
            });

            const result = await res.json();
            const now = new Date().toISOString();

            if (res.ok && result.success) {
                // 저장 성공 시 로컬 상태의 updatedAt을 현재 시간으로 업데이트
                setDrafts(prev => prev.map(d => ({
                    ...d,
                    updatedAt: now
                })));
                toast.success('자기소개서가 서버에 영구 저장되었습니다.', { id: saveToast });
            } else {
                throw new Error(result.error || '저장 실패');
            }
        } catch (error: any) {
            console.error('Save Error Details:', error);
            toast.error(`저장 오류: ${error.message}`, { id: saveToast });
        }
    };
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isCompanyReportOpen, setIsCompanyReportOpen] = useState(false);
    const [companyReportData, setCompanyReportData] = useState<any>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [showCharLimitPopover, setShowCharLimitPopover] = useState(false);
    const [tempCharLimit, setTempCharLimit] = useState<string>('');

    // State for job selection
    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [selectedPosting, setSelectedPosting] = useState<any>(null);

    React.useEffect(() => {
        if (!selectedJob) {
            const fetchHistory = async () => {
                setIsLoadingHistory(true);
                try {
                    const res = await fetch('/api/analyze/jd');
                    const data = await res.json();
                    if (data.history) setHistory(data.history);
                } catch (error) {
                    console.error('Failed to fetch history', error);
                } finally {
                    setIsLoadingHistory(false);
                }
            };
            fetchHistory();
        }
    }, [selectedJob]);


    const handleGenerateDraft = async () => {
        if (isGenerating) return;

        setIsGenerating(true);
        // Next.js client-side Gemini call simulation
        setTimeout(() => {
            const newContents = [...contents];
            newContents[activeTab] = `${companyName}의 ${jobTitle}는 사용자 중심의 경험을 최적화하는 데 있어 업계 표준을 제시하고 있습니다. 저는 과거 데이터 분석 프로젝트 시절, 논리적인 문제 해결 능력을 활용하여 유의미한 비즈니스 성과를 거두었습니다. 입사 후에도 이러한 데이터 기반의 의사결정 역량을 바탕으로 혁신적인 가치를 창출하겠습니다...`;

            setDrafts(drafts.map(d => d.id === activeDraftId ? { ...d, contents: newContents } : d));
            setIsDraftGenerated(true);
            setIsGenerating(false);
        }, 1500);
    };

    const handleAddTab = () => {
        const nextNum = tabs.length + 1;
        const newTabs = [...tabs, `문항 ${nextNum}`];
        const newContents = [...contents, ''];
        const newQuestions = [...(currentDraft.questions || tabs.map((t: string) => t)), `신규 문항 ${nextNum} 내용을 입력하세요.`];
        setDrafts(drafts.map(d => d.id === activeDraftId ? { ...d, tabs: newTabs, contents: newContents, questions: newQuestions } : d));
        setActiveTab(tabs.length);
    };

    const handleDeleteTab = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (tabs.length <= 1) {
            toast.error('최소 한 개의 문항은 유지되어야 합니다.');
            return;
        }

        if (confirm('이 문항을 삭제하시겠습니까?')) {
            const tempTabs = tabs.filter((_, i) => i !== index);
            const newContents = contents.filter((_, i) => i !== index);
            const resequencedTabs = tempTabs.map((_, i) => `문항 ${i + 1}`);
            const newQuestions = (currentDraft.questions || []).filter((_, i) => i !== index);

            setDrafts(drafts.map(d => d.id === activeDraftId ? { ...d, tabs: resequencedTabs, contents: newContents, questions: newQuestions } : d));

            if (activeTab >= index && activeTab > 0) {
                setActiveTab(activeTab - 1);
            } else if (activeTab >= resequencedTabs.length) {
                setActiveTab(resequencedTabs.length - 1);
            }
        }
    };

    const handleAddDraft = () => {
        const newId = `draft-${Date.now()}`;
        const newDraft = {
            id: newId,
            name: `자기소개서 ${drafts.length + 1}`,
            tabs: ['문항 1', '문항 2', '문항 3', '문항 4'],
            questions: ['', '', '', ''],
            contents: ['', '', '', ''],
            charLimits: [700, 700, 700, 700],
            status: '작성전',
            isFinal: false
        };
        setDrafts([...drafts, newDraft]);
        setActiveDraftId(newId);
        setActiveTab(0);
        toast.success('새 자기소개서가 생성되었습니다.');
    };

    const handleDuplicateDraft = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const draftToDup = drafts.find(d => d.id === id);
        if (!draftToDup) return;

        const newId = `draft-${Date.now()}`;
        const newDraft = {
            ...draftToDup,
            id: newId,
            name: `${draftToDup.name} (복사본)`,
            isFinal: false
        };
        setDrafts([...drafts, newDraft]);
        setActiveDraftId(newId);
        toast.success('초안이 복제되었습니다.');
    };

    const handleDeleteDraft = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (drafts.length <= 1) {
            toast.error('최소 한 개의 초안은 유지되어야 합니다.');
            return;
        }
        if (confirm('이 초안 전체를 삭제하시겠습니까?')) {
            const newDrafts = drafts.filter(d => d.id !== id);
            setDrafts(newDrafts);
            if (activeDraftId === id) {
                setActiveDraftId(newDrafts[0].id);
            }
            toast.success('초안이 삭제되었습니다.');
        }
    };

    const handleSetFinal = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDrafts(drafts.map(d => ({
            ...d,
            isFinal: d.id === id
        })));
        toast.success('대표 초안으로 설정되었습니다.');
    };

    const handleRenameDraft = (id: string) => {
        const draft = drafts.find(d => d.id === id);
        if (!draft) return;
        const newName = prompt('초안 이름을 입력하세요:', draft.name);
        if (newName && newName.trim()) {
            setDrafts(drafts.map(d => d.id === id ? { ...d, name: newName.trim() } : d));
        }
    };

    const handleRenameTab = (index: number) => {
        // 기능 제거 (사용자 요청)
    };

    const handleUpdateQuestionDetail = (val: string) => {
        const newQuestions = [...(currentDraft.questions || tabs.map((t: string) => t))];
        newQuestions[activeTab] = val;
        setDrafts(drafts.map(d => d.id === activeDraftId ? { ...d, questions: newQuestions } : d));
    };

    const handleUpdateStatus = (id: string, newStatus: string) => {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
        toast.success(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case '작성중': return 'text-orange-600';
            case '작성 완료': return 'text-green-600';
            case '지원 완료': return 'text-blue-600';
            default: return 'text-slate-500';
        }
    };

    const handleOpenCompanyReport = async (force: boolean = false) => {
        setIsCompanyReportOpen(true);
        if (companyReportData && !force) return;
        setIsLoadingReport(true);
        try {
            const res = await fetch('/api/analyze/company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, jobTitle, forceRefresh: force })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setCompanyReportData(data);
            if (force) toast.success('기업 정보를 새로고침했습니다.');
        } catch (error) {
            console.error('Company report error:', error);
            toast.error('기업 분석 중 오류가 발생했습니다.');
        } finally {
            setIsLoadingReport(false);
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case '작성중': return { color: 'bg-orange-500', text: '작성중' };
            case '작성 완료': return { color: 'bg-green-500', text: '작성 완료' };
            case '지원 완료': return { color: 'bg-blue-500', text: '지원 완료' };
            default: return { color: 'bg-slate-300', text: '작성전' };
        }
    };

    if (!selectedJob) {
        // [1단계] 공고 선택 화면 (기존 루틴)
        return (
            <div className="h-full overflow-y-auto custom-scrollbar px-12 py-10 max-w-5xl mx-auto">
                {/* ... 기존 공고 선택 UI ... */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Edit3 size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">자기소개서 작성 공고 선택</h1>
                    <p className="text-slate-500">작성하실 자기소개서의 공고와 직무를 선택해주세요.</p>
                </div>

                {!selectedPosting ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Database size={20} className="text-blue-500" /> 최근 분석한 공고 리스트
                            </h2>
                        </div>
                        {isLoadingHistory ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-2xl border border-slate-100"></div>
                                ))}
                            </div>
                        ) : history.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {history.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedPosting(item)}
                                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider">
                                                {getSiteName(item.jdUrl)}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">{formatDate(item.createdAt)}</span>
                                        </div>
                                        <p className="text-lg font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                            {cleanCompanyName(item.companyName)}
                                        </p>
                                        <div className="flex items-center justify-between mt-3 text-sm">
                                            <span className="text-slate-500 font-medium">분석된 직무 {item.analysisResult?.length || 0}개</span>
                                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                <p className="text-slate-400 font-medium mb-4">분석한 공고가 없습니다.</p>
                                <button
                                    onClick={() => onViewChange('analysis')}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
                                >
                                    공고 분석하러 가기
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <button
                            onClick={() => setSelectedPosting(null)}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-bold transition-colors mb-4"
                        >
                            <ArrowLeft size={16} /> 뒤로가기
                        </button>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Target size={20} className="text-purple-500" /> [{cleanCompanyName(selectedPosting.companyName)}] 의 어떤 직무로 작성할까요?
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedPosting.analysisResult.map((job: any, idx: number) => (
                                <div
                                    key={idx}
                                    onClick={() => onSelectJob(job)}
                                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-purple-400 transition-all cursor-pointer group flex flex-col justify-between h-full"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all">
                                                <Briefcase size={20} />
                                            </div>
                                            <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all">
                                                <ArrowRight size={20} />
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-2 leading-tight">{job.모집부문 || job.모집직무}</h3>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {job.핵심역량?.slice(0, 3).map((skill: string, sIdx: number) => (
                                                <span key={sIdx} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">#{skill}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-slate-400 group-hover:text-purple-600 transition-colors">
                                        선택하여 자기소개서 관리 <ChevronRight size={14} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (!isWorkspaceOpen) {
        // [2단계] 자기소개서 리스트 관리 (사용자 요청에 따라 신설)
        return (
            <div className="h-full overflow-y-auto custom-scrollbar px-12 py-10 max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <button
                            onClick={() => onSelectJob(null)}
                            className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-xs font-bold transition-all mb-2"
                        >
                            <ArrowLeft size={14} /> 공고 선택으로 돌아가기
                        </button>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            [{companyName}] {jobTitle}
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs rounded-lg">전체 {drafts.length}개</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-5">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                        >
                            <Download size={18} /> 전체 변경사항 저장
                        </button>
                        <button
                            onClick={handleAddDraft}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                        >
                            <PlusCircle size={18} /> 새 자기소개서 추가
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {drafts.map((draft) => (
                        <div
                            key={draft.id}
                            className={`group bg-white rounded-3xl border-2 p-6 transition-all hover:shadow-xl hover:shadow-slate-200/50 ${activeDraftId === draft.id ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100 hover:border-blue-200'}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900">{draft.name}</span>
                                            {draft.isFinal && <Star size={14} className="fill-yellow-400 text-yellow-400" />}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusInfo(draft.status).color}`}></div>
                                            <span className="text-[10px] text-slate-400 font-medium">최종 수정: {formatRelativeTime(draft.updatedAt)}</span>
                                        </div>
                                    </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={(e) => handleDuplicateDraft(e, draft.id)} className="p-2 hover:bg-slate-50 text-slate-400 rounded-lg transition-all" title="복제"><Copy size={16} /></button>
                                    <button onClick={(e) => handleDeleteDraft(e, draft.id)} className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-all" title="삭제"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-black uppercase tracking-wider">진행 상태</span>
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenStatusId(openStatusId === draft.id ? null : draft.id);
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white hover:border-blue-400 transition-all group/status"
                                        >
                                            <div className={`w-2 h-2 rounded-full shadow-sm ${getStatusInfo(draft.status || '작성전').color}`}></div>
                                            <span className="text-[11px] font-black text-slate-700">{draft.status || '작성전'}</span>
                                            <ChevronDown size={12} className={`text-slate-400 transition-transform ${openStatusId === draft.id ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {openStatusId === draft.id && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onClick={() => setOpenStatusId(null)}
                                                    ></div>
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        className="absolute right-0 top-full mt-2 w-32 bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-200/50 p-1.5 z-20"
                                                    >
                                                        {['작성전', '작성중', '작성 완료', '지원 완료'].map((s) => (
                                                            <button
                                                                key={s}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleUpdateStatus(draft.id, s);
                                                                    setOpenStatusId(null);
                                                                }}
                                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black transition-all hover:bg-slate-50 ${draft.status === s ? 'bg-slate-50' : ''}`}
                                                            >
                                                                <div className={`w-1.5 h-1.5 rounded-full ${getStatusInfo(s).color}`}></div>
                                                                <span className={getStatusColor(s)}>{s}</span>
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">문항 수</span>
                                    <span className="text-slate-900 font-black">{draft.tabs?.length || 0}개</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    // 작성전 -> 작성중 자동 전환 (즉시 상태 업데이트)
                                    if (draft.status === '작성전') {
                                        setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: '작성중' } : d));
                                        toast.success("상태가 '작성중'으로 변경되었습니다.");
                                    }
                                    setActiveDraftId(draft.id);
                                    setIsWorkspaceOpen(true);
                                    setActiveTab(0);
                                }}
                                className="w-full py-3 bg-slate-50 text-slate-900 text-sm font-black rounded-2xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                자기소개서 작성하기 <ChevronRight size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // [3단계] 워크스페이스 (실제 편집 화면)
    return (
        <div className="flex h-full overflow-hidden bg-white">
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
                {/* Workspace Header */}
                <div className="px-8 pt-6 pb-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsWorkspaceOpen(false)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-900 hover:text-white transition-all"
                            >
                                <ArrowLeft size={14} /> 목록으로
                            </button>
                            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-slate-900">{currentDraft.name}</h2>
                                <div className="flex items-center gap-1.5 ml-3 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
                                    <div className={`w-2 h-2 rounded-full shadow-sm ${getStatusInfo(currentDraft.status || '작성전').color}`}></div>
                                    <span className="text-[11px] font-black text-slate-700">
                                        {currentDraft.status || '작성전'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
                            >
                                <Save size={16} /> 저장하기
                            </button>
                            <button
                                onClick={() => handleOpenCompanyReport()}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-100 bg-white text-xs font-black text-slate-700 hover:border-blue-200 transition-all"
                            >
                                <BarChart3 size={16} /> 기업 분석
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-6 border-b border-slate-100">
                        <div className="flex gap-6">
                            {tabs.map((tab, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveTab(i)}
                                    className={`group relative pb-3 text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === i ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <div className="relative">
                                        <span className="max-w-[120px] truncate block">{tab}</span>
                                        {activeTab === i && (
                                            <motion.div
                                                layoutId="tabUnderline"
                                                className="absolute -bottom-[1.5px] left-0 right-0 h-0.5 bg-blue-600"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                    </div>
                                    {tabs.length > 1 && (
                                        <span
                                            onClick={(e) => handleDeleteTab(e, i)}
                                            className="p-0.5 rounded-md hover:bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500"
                                            title="삭제"
                                        >
                                            <X size={12} />
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleAddTab}
                            className="pb-3 text-slate-400 hover:text-blue-600 transition-colors"
                            title="문항 추가"
                        >
                            <PlusCircle size={18} />
                        </button>
                    </div>
                </div>

                {/* Question Box */}
                <div className="px-8 py-4">
                    <div className={`relative transition-all duration-300 ${isEditingQuestion ? 'bg-white rounded-3xl border border-blue-300 shadow-xl shadow-blue-100/50 p-1.5' : 'bg-gradient-to-br from-blue-50/80 to-indigo-50/40 rounded-3xl border border-blue-100/80 p-6 cursor-pointer hover:shadow-md hover:shadow-blue-100/40 hover:border-blue-200 group'}`}>
                        {isEditingQuestion ? (
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                        <span className="text-sm font-bold text-slate-700">문항 상세 내용 편집</span>
                                    </div>
                                    <button
                                        onClick={() => setIsEditingQuestion(false)}
                                        className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-all shadow-sm"
                                    >
                                        작성 완료
                                    </button>
                                </div>
                                <textarea
                                    autoFocus
                                    className="w-full min-h-[100px] bg-slate-50/50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 transition-all resize-none leading-relaxed"
                                    placeholder="자기소개서 문항 내용을 상세히 입력하세요 (예: 본인의 지원동기와 입사 후 포부를 기술해 주세요)"
                                    value={currentQuestionDetail}
                                    onChange={(e) => handleUpdateQuestionDetail(e.target.value)}
                                />
                            </div>
                        ) : (
                            <div className="w-full relative px-2 py-1" onClick={() => setIsEditingQuestion(true)}>
                                {/* Edit Badge */}
                                <div className="absolute -top-3 -right-2 flex items-center gap-1.5 text-[10px] font-black tracking-wide text-blue-600 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-100 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 z-10">
                                    <Edit3 size={12} strokeWidth={3} /> 클릭하여 수정
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-1.5 min-h-[40px] rounded-full bg-gradient-to-b from-blue-400 to-indigo-400 shrink-0"></div>
                                    <div className="flex-1 relative">
                                        <p className="text-slate-800 font-extrabold text-[15px] leading-relaxed tracking-tight break-keep pt-1.5">
                                            {currentQuestionDetail || <span className="text-slate-400 font-medium italic">문항 내용을 입력해 주세요. (클릭하여 작성)</span>}
                                        </p>

                                        {/* Example Tooltip - appears on hover when empty */}
                                        {!currentQuestionDetail && (
                                            <div className="absolute left-0 top-full mt-3 w-[340px] bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-4 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center">
                                                        <HelpCircle size={12} className="text-blue-600" />
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-500 tracking-wide">질문 예시</span>
                                                </div>
                                                <ul className="space-y-2">
                                                    {[
                                                        '지원 동기 및 입사 후 포부를 기술해 주세요.',
                                                        '직무 관련 프로젝트 경험을 구체적으로 서술해 주세요.',
                                                        '팀워크 및 협업 과정에서의 성과를 알려주세요.',
                                                        '본인의 강점과 이를 활용한 경험을 설명해 주세요.',
                                                        '어려움을 극복한 경험과 그로부터 배운 점을 서술해 주세요.',
                                                    ].map((ex, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                                                            <span className="mt-0.5 w-4 h-4 rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0">{i + 1}</span>
                                                            <span>{ex}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 italic">위 내용은 참고 예시이며, 실제 공고의 문항을 직접 입력해 주세요.</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 px-8 py-2 overflow-y-auto custom-scrollbar">
                    <div className="relative h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <h3 className="text-slate-900 font-bold text-sm shrink-0">작성 내용</h3>
                            </div>

                            <div className="flex items-center gap-0 shrink-0 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm relative">
                                {/* 현재 글자수 표시 */}
                                <div className="flex items-center gap-0 px-1">
                                    <span className={`text-xs font-black transition-colors ${((contents[activeTab] || '').length > ((currentDraft.charLimits || [])[activeTab] || 700)) ? 'text-red-600' : 'text-slate-900'}`}>
                                        {(contents[activeTab] || '').length.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold ml-0.5">자</span>
                                </div>

                                <div className="text-slate-300 text-[10px] font-bold mx-0">/</div>

                                {/* 목표 글자수 표시 (클릭 시 팝오버) */}
                                <div 
                                    className="flex items-center gap-0 px-1 transition-all rounded-lg relative cursor-pointer"
                                    onClick={() => {
                                        setTempCharLimit(((currentDraft.charLimits || [])[activeTab] || 700).toString());
                                        setShowCharLimitPopover(!showCharLimitPopover);
                                    }}
                                >
                                    <span className="text-xs font-black text-slate-400">
                                        {((currentDraft.charLimits || [])[activeTab] || 700).toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold ml-0.5">자</span>

                                    {/* 5번 아이디어: 인라인 팝오버 */}
                                    <AnimatePresence>
                                        {showCharLimitPopover && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-30" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowCharLimitPopover(false);
                                                    }}
                                                />
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-40"
                                                >
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">글자수 제한</span>
                                                            <Settings size={12} className="text-slate-300" />
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 focus-within:border-blue-400 transition-all">
                                                            <input 
                                                                type="number"
                                                                className="flex-1 bg-transparent text-sm font-black text-blue-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                value={tempCharLimit}
                                                                autoFocus
                                                                onChange={(e) => setTempCharLimit(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        const val = parseInt(tempCharLimit);
                                                                        const newLimits = [...(currentDraft.charLimits || [])];
                                                                        newLimits[activeTab] = isNaN(val) || val < 0 ? 700 : val;
                                                                        setDrafts(drafts.map(d => d.id === activeDraftId ? { ...d, charLimits: newLimits } : d));
                                                                        setShowCharLimitPopover(false);
                                                                        toast.success(`글자수 제한이 ${newLimits[activeTab]}자로 설정되었습니다.`);
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-[10px] text-slate-400 font-bold">자</span>
                                                        </div>
                                                        
                                                        {/* 0자~2000자 슬라이더 조절 기능 */}
                                                        <div className="px-1 py-1">
                                                            <input 
                                                                type="range"
                                                                min="0"
                                                                max="2000"
                                                                step="100"
                                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                                value={isNaN(parseInt(tempCharLimit)) ? 0 : parseInt(tempCharLimit)}
                                                                onChange={(e) => setTempCharLimit(e.target.value)}
                                                            />
                                                            <div className="flex justify-between mt-1 px-0.5">
                                                                <span className="text-[8px] text-slate-300 font-bold uppercase tracking-tighter">0자</span>
                                                                <span className="text-[8px] text-slate-300 font-bold uppercase tracking-tighter">2000자</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                const val = parseInt(tempCharLimit);
                                                                const newLimits = [...(currentDraft.charLimits || [])];
                                                                newLimits[activeTab] = isNaN(val) || val <= 0 ? 700 : val;
                                                                setDrafts(drafts.map(d => d.id === activeDraftId ? { ...d, charLimits: newLimits } : d));
                                                                setShowCharLimitPopover(false);
                                                                toast.success(`목표 글자수가 ${newLimits[activeTab]}자로 변경되었습니다.`);
                                                            }}
                                                            className="w-full py-2 bg-blue-600 text-white rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                                                        >
                                                            적용하기
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                        <textarea
                            className="flex-1 w-full min-h-[300px] resize-none rounded-2xl border border-slate-200 bg-white p-6 text-base text-slate-900 placeholder:text-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none shadow-sm leading-relaxed"
                            placeholder="이곳에 내용을 입력하거나 하단의 '초안 생성' 버튼을 눌러 AI의 도움을 받아보세요."
                            value={contents[activeTab] || ''}
                            onChange={(e) => {
                                const newContents = [...contents];
                                newContents[activeTab] = e.target.value;
                                setDrafts(drafts.map(d => d.id === activeDraftId ? { ...d, contents: newContents } : d));
                            }}
                        />

                        {/* Footer Actions */}
                        <div className="mt-6 py-6 border-t border-slate-100 bg-white">
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleGenerateDraft}
                                    disabled={isGenerating}
                                    className={`w-full flex items-center justify-center gap-2 h-12 bg-blue-600 text-white shadow-lg shadow-blue-600/20 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all ${isGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" /> 초안 생성 중...
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={18} className="fill-white" /> AI 초안 생성
                                        </>
                                    )}
                                </button>


                                <button
                                    onClick={() => setShowEvaluation(true)}
                                    className="w-full flex items-center justify-center gap-2 h-12 bg-slate-900 text-white shadow-lg shadow-slate-900/20 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
                                >
                                    <Brain size={18} /> 전문가 평가 받기
                                </button>
                            </div>
                        </div>

                        {/* Evaluation Section */}
                        {showEvaluation && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 pb-12 space-y-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-slate-900 font-bold text-lg flex items-center gap-2">
                                        <Brain className="text-blue-600" size={24} /> AI 전문가 평가 결과
                                    </h3>
                                    <div className="px-3 py-1 bg-blue-600/10 text-blue-600 text-xs font-bold rounded-full">
                                        분석 완료
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <EvaluationCard
                                        icon={<Rocket className="text-blue-600" />}
                                        title="직무 담당자 평가"
                                        subtitle="Hard Skills & Projects"
                                        rating={4}
                                        feedback="매출 15% 증대와 같은 정량적 성과가 잘 드러나 있습니다. 다만, 사용한 툴(Python, Tableau 등)에 대한 언급을 추가하면 전문성이 더욱 돋보일 것입니다."
                                        tags={['데이터 분석 역량 우수', '직무 적합성 높음']}
                                    />
                                    <EvaluationCard
                                        icon={<Users className="text-purple-600" />}
                                        title="인사 담당자 평가"
                                        subtitle="Soft Skills & Culture Fit"
                                        rating={5}
                                        feedback="협업 경험을 기술한 부분에서 '소통'과 '배려' 키워드가 잘 드러납니다. 회사의 핵심 가치인 '팀워크'와 85% 이상 일치하는 것으로 분석됩니다."
                                        tags={['협업 능력 탁월', '문제 해결력']}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Sidebar */}
            <motion.div
                initial={false}
                animate={{ width: isGuideOpen ? 420 : 0, opacity: isGuideOpen ? 1 : 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="bg-slate-50/50 flex flex-col border-l border-slate-200 overflow-hidden shrink-0"
            >
                <div className="flex flex-col h-full bg-white w-[420px]">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-slate-900 font-bold text-base flex items-center gap-2">
                            <HelpCircle className="text-slate-400 fill-slate-400/10" size={20} /> AI 작성 가이드
                            <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] rounded-md font-black italic">DISABLED</span>
                        </h3>
                        <button
                            onClick={() => setIsGuideOpen(false)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative">
                        {/* Disabled Overlay */}
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                                <ShieldAlert size={32} className="text-slate-400" />
                            </div>
                            <h4 className="text-slate-900 font-black text-lg mb-2">기능 비활성화</h4>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">사용자 요청에 따라 AI 작성 가이드 기능이<br />현재 비활성화된 상태입니다.</p>
                            <div className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black rounded-full tracking-widest uppercase">Unavailable</div>
                        </div>

                        <div className="opacity-40 grayscale pointer-events-none">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">문항 분석</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 mb-1">문항 유형</p>
                                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                                        <LayoutDashboard size={14} className="text-blue-600" /> 지원동기
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 mb-1">문항 의도</p>
                                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                                        <Target size={14} className="text-purple-500" /> 직무 적합성
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="opacity-40 grayscale pointer-events-none">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">AI 작성 전략 (JD 기반)</h4>
                            <div className="space-y-3">
                                {currentStrategies.map((strategy, idx) => (
                                    <div key={idx} className="flex gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="w-6 h-6 rounded-full bg-white text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                                            {idx + 1}
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed font-medium">{strategy}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 기업 분석 리포트 팝업 */}
            <AnimatePresence>
                {isCompanyReportOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
                        >
                            {/* 헤더 */}
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div>
                                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-black tracking-wider rounded-lg mb-2">
                                        {companyName}
                                    </span>
                                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <BarChart3 size={22} className="text-blue-600" /> 기업 분석 리포트
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsCompanyReportOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </div>

                            {/* 콘텐츠 */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {isLoadingReport ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <Loader2 size={36} className="animate-spin text-blue-600" />
                                        <p className="text-slate-500 font-medium">'{companyName}'의 인재상과 최신 뉴스를 수집 중입니다...</p>
                                        <p className="text-xs text-slate-400">약 10~20초 소요될 수 있습니다</p>
                                    </div>
                                ) : companyReportData ? (
                                    <>
                                        {/* 인재상 섹션 */}
                                        {companyReportData.analysis?.인재상?.length > 0 && (
                                            <div className="bg-green-50/50 p-5 rounded-2xl border border-green-100">
                                                <h4 className="text-sm font-black text-green-800 flex items-center gap-2 mb-4">
                                                    <Target size={18} className="text-green-600" /> 인재상 (Ideal Candidate)
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {companyReportData.analysis.인재상.map((item: any, idx: number) => (
                                                        <div key={idx} className="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
                                                            <div className="font-bold text-sm text-slate-900 mb-1.5 flex items-center gap-1.5">
                                                                <span className="w-5 h-5 bg-green-100 text-green-700 text-[10px] font-black rounded-full flex items-center justify-center">{idx + 1}</span>
                                                                {item.키워드}
                                                            </div>
                                                            <p className="text-xs text-slate-600 leading-relaxed">{item.내용}</p>

                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 조직문화 섹션 */}
                                        {companyReportData.analysis?.조직문화?.length > 0 && (
                                            <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                                                <h4 className="text-sm font-black text-blue-800 flex items-center gap-2 mb-4">
                                                    <Users size={18} className="text-blue-600" /> 조직문화 (Culture)
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {companyReportData.analysis.조직문화.map((item: any, idx: number) => (
                                                        <div key={idx} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                                                            <div className="font-bold text-sm text-slate-900 mb-1.5 flex items-center gap-1.5">
                                                                <span className="w-5 h-5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full flex items-center justify-center">{idx + 1}</span>
                                                                {item.키워드}
                                                            </div>
                                                            <p className="text-xs text-slate-600 leading-relaxed">{item.내용}</p>

                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 관련 뉴스 섹션 */}
                                        {Array.isArray(companyReportData.news) && companyReportData.news.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-4">
                                                    <Newspaper size={18} className="text-slate-600" /> 기업 최신 뉴스
                                                </h4>
                                                <div className="space-y-3">
                                                    {companyReportData.news.map((news: any, idx: number) => (
                                                        <a
                                                            key={idx}
                                                            href={news.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-start justify-between gap-3 p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all group"
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 line-clamp-2">{news.title}</p>
                                                                <p className="text-xs text-slate-400 mt-1">{news.pub_date || '일자 미상'}</p>
                                                                {news.description && (
                                                                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{news.description}</p>
                                                                )}
                                                            </div>
                                                            <ExternalLink size={14} className="text-slate-300 group-hover:text-blue-400 shrink-0 mt-1" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 분석 실패 시 */}
                                        {companyReportData.analysis?.error && (
                                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                                ⚠️ 기업 분석 중 오류: {companyReportData.analysis.error}
                                            </div>
                                        )}
                                    </>
                                ) : null}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ExperienceBankView() {
    const [documents, setDocuments] = useState<any[]>([]);
    const [experiences, setExperiences] = useState<any[]>([]);
    const [uploadingType, setUploadingType] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    React.useEffect(() => {
        fetch(`/api/bank?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                if (data.documents) setDocuments(data.documents);
                if (data.experiences) setExperiences(data.experiences);
            })
            .catch(err => console.error('[GET Bank Data] Failed:', err));
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingType(type);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        try {
            const res = await fetch(`/api/bank?t=${Date.now()}`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (res.status !== 200) throw new Error(data.error || `Error ${res.status}`);

            setDocuments(prev => [...prev, data]);
            toast.success('문서가 업로드되었습니다.');
        } catch (error: any) {
            console.error(error);
            toast.error(`업로드 실패: ${error.message}`);
        } finally {
            setUploadingType(null);
            if (e.target) e.target.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/bank?id=${id}&t=${Date.now()}`, { method: 'DELETE' });
            if (res.ok) {
                setDocuments(prev => prev.filter(d => d.id !== id));
                toast.success('삭제되었습니다.');
            }
        } catch (error) {
            console.error(error);
            toast.error('삭제에 실패했습니다.');
        }
    };

    const handleDeleteExperience = async (id: any) => {
        if (!confirm('이 경험 기록을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/bank?expId=${id}&t=${Date.now()}`, { method: 'DELETE' });
            if (res.ok) {
                setExperiences(prev => prev.filter(e => e.id !== id));
                toast.success('삭제되었습니다.');
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
                {/* Header Section */}
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
                                    내 프로젝트 및 실무 서류
                                </h2>
                                <div className="flex items-center gap-3 text-sm font-bold px-4 py-2 bg-slate-100 text-slate-500 rounded-xl">
                                    업로드 현황 <span className="text-blue-600">{uploadedCount}/2</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="group/card">
                                    <DocumentUploadCard
                                        type="RESUME"
                                        title="경력기술서 / 이력서"
                                        documents={documents}
                                        handleUpload={handleUpload}
                                        handleDelete={handleDelete}
                                        uploadingType={uploadingType}
                                    />
                                    <p className="mt-3 text-xs text-slate-400 font-medium px-2 italic">PDF, 이미지 형식이 가장 분석 품질이 좋습니다.</p>
                                </div>
                                <div className="group/card">
                                    <DocumentUploadCard
                                        type="PORTFOLIO"
                                        title="포트폴리오 / 기획서"
                                        documents={documents}
                                        handleUpload={handleUpload}
                                        handleDelete={handleDelete}
                                        uploadingType={uploadingType}
                                    />
                                    <p className="mt-3 text-xs text-slate-400 font-medium px-2 italic">성과 위주의 포트폴리오 분석을 권장합니다.</p>
                                </div>
                            </div>

                            <div className="mt-12 pt-10 border-t border-slate-100 bg-slate-50/30 -mx-10 -mb-10 p-10 flex flex-col items-center">
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || documents.length === 0}
                                    className={`relative group flex items-center justify-center gap-4 px-16 py-6 rounded-3xl font-black text-2xl transition-all shadow-2xl active:scale-95 ${isAnalyzing || documents.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600 hover:-translate-y-1 shadow-blue-500/30'}`}
                                >
                                    {isAnalyzing ? (
                                        <><Loader2 size={32} className="animate-spin" /> <span>심층 역량 추출 중...</span></>
                                    ) : (
                                        <>
                                            <Brain size={32} className="text-blue-400" />
                                            <span>AI 통합 경험 분석</span>
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
                                {experiences.map(exp => (
                                    <ExperienceCard
                                        key={exp.id || Math.random().toString()}
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

function CompanyAnalysisView({
    jdUrl,
    setJdUrl,
    isAnalyzing,
    onAnalyze,
    analysisResult,
    setAnalysisResult,
    analysisResultId,
    setAnalysisResultId,
    onNavigateToWorkspace
}: {
    jdUrl: string,
    setJdUrl: (url: string) => void,
    isAnalyzing: boolean,
    onAnalyze: () => void,
    analysisResult: any,
    setAnalysisResult: (result: any) => void,
    analysisResultId?: number | null,
    setAnalysisResultId?: (id: number | null) => void,
    onNavigateToWorkspace: (job: any) => void
}) {
    const [selectedJob, setSelectedJob] = React.useState<any>(null);
    const [history, setHistory] = React.useState<any[]>([]);

    React.useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/analyze/jd');
                const data = await res.json();
                if (data.history) setHistory(data.history);
            } catch (error) {
                console.error('Failed to fetch history', error);
            }
        };
        fetchHistory();
    }, []);

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
        setJdUrl(''); // Prevent the URL from popping back up into the input
        if (item.analysisResult) {
            setAnalysisResult(item.analysisResult);
            if (setAnalysisResultId && item.id) {
                setAnalysisResultId(item.id);
            }
        }
    };

    const favoriteJobs = React.useMemo(() => {
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
            // Wait for state to update, then select the job
            setTimeout(() => setSelectedJob(job), 100);
        }
    };

    const handleRemoveJobFromCurrentResult = async (e: React.MouseEvent, indexToRemove: number) => {
        e.stopPropagation();
        if (!confirm('해당 직무를 삭제하시겠습니까?')) return;

        const remainingJobs = analysisResult.filter((_: any, i: number) => i !== indexToRemove);
        setAnalysisResult(remainingJobs.length > 0 ? remainingJobs : null);

        if (analysisResultId) {
            // 1. 상태 업데이트 방식 (즉각적인 화면 반영: History 상태 동기화)
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
            // 1. 상태 업데이트 방식 (즉각적인 화면 반영: History 상태 동기화)
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

                // 공고가 모두 삭제되었으므로 최근 분석한 공고(history)에서도 제거
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
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
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
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 mt-1 shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                        <span className="flex-1">{selectedJob.근무지 || '근무지 미상'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium whitespace-nowrap">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
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

                            <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                                <button
                                    onClick={() => onNavigateToWorkspace(selectedJob)}
                                    className="w-full py-4 fill-white bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
                                >
                                    <Edit3 size={18} /> 이 직무로 자기소개서 작성하기
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function MockInterviewView() {
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

function ExperienceCard({ experience, onDelete }: { experience: Experience, onDelete?: () => void }) {
    const [isOpen, setIsOpen] = useState(false);

    // Parse tags if they are string-encoded JSON
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
            <div className={`p-5 cursor-pointer flex /*items-center*/ ${isOpen ? 'min-h-[130px] h-auto items-start' : 'h-[130px] items-center'}`} onClick={() => setIsOpen(!isOpen)}>
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

function DocumentUploadCard({ type, title, documents, handleUpload, handleDelete, uploadingType }: { type: string, title: string, documents: any[], handleUpload: (e: React.ChangeEvent<HTMLInputElement>, type: string) => void, handleDelete: (id: string) => void, uploadingType: string | null }) {
    const categoryDocs = documents.filter(d => d.type === type);
    const fileRef = React.useRef<HTMLInputElement>(null);

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

function StatBox({ label, value, trend, trendColor }: { label: string, value: string, trend: string, trendColor: string }) {
    return (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mb-2">{value}</p>
            <div className={`flex items-center gap-1 text-xs font-bold ${trendColor} bg-slate-50 w-fit px-2 py-0.5 rounded-full`}>
                {trend}
            </div>
        </div>
    );
}

function EvaluationCard({ icon, title, subtitle, rating, feedback, tags }: { icon: React.ReactNode, title: string, subtitle: string, rating: number, feedback: string, tags: string[] }) {
    return (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
                {icon}
                <div>
                    <h4 className="font-bold text-sm text-slate-900">{title}</h4>
                    <p className="text-[10px] text-slate-500">{subtitle}</p>
                </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">{feedback}</p>
        </div>
    );
}
