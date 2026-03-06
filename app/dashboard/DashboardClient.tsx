'use client';

import React, { useState } from 'react';
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
    UploadCloud,
    Link as LinkIcon,
    Folder,
    Edit3,
    TrendingUp,
    Diamond,
    CheckCircle2,
    Brain,
    Star,
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
    LogOut,
    Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSession, signOut } from 'next-auth/react';
import type { ViewType, Experience } from './dashboard.types';

// --- Mock Data ---
const MOCK_EXPERIENCES: Experience[] = [];

export default function DashboardClient() {
    const { data: session } = useSession();
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const userName = session?.user?.name || '사용자';
    const userEmail = session?.user?.email || 'user@example.com';

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardView userName={userName} />;
            case 'workspace': return <WorkspaceView />;
            case 'experience': return <ExperienceBankView />;
            case 'analysis': return <CompanyAnalysisView />;
            case 'interview': return <MockInterviewView />;
            default: return <DashboardView userName={userName} />;
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
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
                    <NavItem icon={<FileSearch size={20} />} label="직무 분석" active={currentView === 'analysis'} onClick={() => setCurrentView('analysis')} collapsed={!isSidebarOpen} />
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
                                    currentView === 'analysis' ? '직무 분석' :
                                        currentView === 'interview' ? 'AI 모의 면접' : '대시보드'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        {currentView === 'workspace' && (
                            <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all mr-2">
                                저장하기
                            </button>
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

function DashboardView({ userName }: { userName: string }) {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">반가워요, {userName}님! 👋</h1>
                    <p className="text-slate-500 max-w-2xl">다음 커리어를 준비할 준비가 되셨나요? 새로운 직무를 분석하거나 경험 뱅크를 업데이트해보세요.</p>
                </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 shadow-xl text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-10 transform translate-x-12 -translate-y-12">
                    <BarChart3 size={160} />
                </div>
                <div className="relative z-10 max-w-3xl">
                    <h2 className="text-2xl font-bold mb-2">빠른 분석 시작</h2>
                    <p className="text-blue-100 mb-6 text-lg">채용 공고 URL을 입력하거나 파일을 업로드하여 AI 기반의 맞춤형 인사이트와 초안을 즉시 받아보세요.</p>
                    <div className="bg-white p-2 rounded-xl shadow-lg flex flex-col md:flex-row gap-2">
                        <div className="flex-1 flex items-center bg-slate-50 rounded-lg px-4 py-2 border border-slate-100 focus-within:ring-2 focus-within:ring-blue-600/30 transition-all">
                            <LinkIcon className="text-slate-400 mr-3" size={20} />
                            <input className="bg-transparent border-none focus:ring-0 w-full text-slate-800 placeholder-slate-400" placeholder="공고 URL을 여기에 붙여넣으세요..." type="text" />
                        </div>
                        <div className="flex gap-2">
                            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap">
                                <UploadCloud size={18} />
                                PDF 업로드
                            </button>
                            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors flex items-center gap-2 whitespace-nowrap">
                                지금 분석하기
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
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
                        <ActivityItem icon={<FileSearch className="text-blue-600" />} title="Product Manager @ Stripe" subtitle="직무 분석 • 2시간 전" status="완료됨" statusColor="bg-green-100 text-green-800" />
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
        </div>
    );
}

function StatCard({ icon, label, value, unit, badge, badgeColor, isTextValue }: { icon: React.ReactNode, label: string, value: string, unit: string, badge: string, badgeColor: string, isTextValue?: boolean }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
                <span className={`${badgeColor} text-xs font-bold px-2 py-1 rounded-full`}>{badge}</span>
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
            <div className="flex-1 min-w-0">
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

function WorkspaceView() {
    const [activeTab, setActiveTab] = useState(0);
    const [content, setContent] = useState('');
    const [showEvaluation, setShowEvaluation] = useState(false);
    const [isDraftGenerated, setIsDraftGenerated] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(true);

    // Current question context (In a real app, this would change based on activeTab)
    const currentQuestion = {
        title: "지원 동기 및 입사 후 포부",
        description: "삼성전자 DX부문에 지원한 동기와 본인이 이 직무에 적합하다고 생각하는 이유를 구체적으로 서술해 주십시오. (700자 이내)",
        strategies: [
            '삼성전자의 최신 DX 이슈와 본인의 역량을 연결하여 구체적인 기여 방안을 제시하세요.',
            '단순한 관심보다는 직무 관련 프로젝트 경험을 통해 준비된 인재임을 강조해야 합니다.',
            '입사 후 포부는 3년, 5년, 10년 단위로 구체화하여 성장 로드맵을 보여주세요.'
        ],
        experiences: [
            { title: 'A사 데이터 분석 인턴 프로젝트', type: '직무 관련', content: 'Python을 활용하여 고객 이탈률을 15% 감소시킨 경험. 데이터 전처리부터 모델링까지 주도적으로 수행함.' },
            { title: 'B 공모전 대상 수상', type: '문제 해결', content: '팀장으로서 팀원 간의 갈등을 중재하고, 창의적인 아이디어로 대상을 수상함. 협업 능력 강조 가능.' },
            { title: '학부 연구생 활동', type: '전문성', content: '최신 딥러닝 논문을 구현하고 실험 결과를 도출함. 끈기 있게 연구에 매진한 태도 어필.' }
        ]
    };

    const handleGenerateDraft = async () => {
        if (isGenerating) return;

        setIsGenerating(true);
        // Next.js client-side Gemini call simulation
        setTimeout(() => {
            setContent("삼성전자의 DX부문은 사용자 중심의 경험을 최적화하는 데 있어 업계 표준을 제시하고 있습니다. 저는 A사 데이터 분석 인턴 시절, Python을 활용하여 고객 이탈률을 15% 감소시킨 성과를 거두었습니다...");
            setIsDraftGenerated(true);
            setIsGenerating(false);
        }, 1500);
    };

    return (
        <div className="flex h-full overflow-hidden bg-white">
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
                {/* Workspace Header */}
                <div className="px-8 pt-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
                            <span>삼성전자</span>
                            <ChevronRight size={12} />
                            <span>DX 부문</span>
                            <ChevronRight size={12} />
                            <span className="text-blue-600">자기소개서 작성</span>
                        </div>
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                            <BarChart3 size={16} /> 기업 분석 리포트
                        </button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <h1 className="text-2xl font-bold text-slate-900">자기소개서 작성 워크스페이스</h1>
                        {!isGuideOpen && (
                            <button
                                onClick={() => setIsGuideOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
                            >
                                <Brain size={16} /> AI 가이드 열기
                            </button>
                        )}
                    </div>
                    <div className="flex gap-6 mt-6 border-b border-slate-100">
                        {['문항 1', '문항 2', '문항 3', '문항 4'].map((tab, i) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(i)}
                                className={`pb-3 text-sm font-bold transition-colors ${activeTab === i ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Question Box */}
                <div className="px-8 py-4">
                    <div className="flex items-start gap-4 rounded-2xl bg-blue-50 border border-blue-100 p-5">
                        <div className="rounded-full bg-blue-100 p-2.5 text-blue-600 shrink-0">
                            <HelpCircle size={20} className="fill-blue-600/10" />
                        </div>
                        <div>
                            <p className="text-slate-900 font-bold text-sm">질문: {currentQuestion.title}</p>
                            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{currentQuestion.description}</p>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 px-8 py-2 overflow-y-auto custom-scrollbar">
                    <div className="relative h-full flex flex-col">
                        <h3 className="text-slate-900 font-bold text-sm mb-3">작성 내용</h3>
                        <textarea
                            className="flex-1 w-full min-h-[300px] resize-none rounded-2xl border border-slate-200 bg-white p-6 text-base text-slate-900 placeholder:text-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none shadow-sm leading-relaxed"
                            placeholder="이곳에 내용을 입력하거나 하단의 '초안 생성' 버튼을 눌러 AI의 도움을 받아보세요."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />

                        {/* Footer Actions */}
                        <div className="mt-6 py-6 border-t border-slate-100 bg-white">
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-xs text-slate-400 font-medium">
                                    글자수: <span className="text-slate-900 font-bold">{content.length}자</span> / 700자
                                </div>
                            </div>
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

                                <button className="w-full flex items-center justify-center gap-2 h-12 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">
                                    <Edit3 size={18} className="text-blue-600" /> 소제목 생성
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
                            <HelpCircle className="text-blue-600 fill-blue-600/10" size={20} /> AI 작성 가이드
                        </h3>
                        <button
                            onClick={() => setIsGuideOpen(false)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                        <div>
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

                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">AI 작성 전략 (JD 기반)</h4>
                            <div className="space-y-3">
                                {currentQuestion.strategies.map((strategy, idx) => (
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
        </div>
    );
}

function ExperienceBankView() {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-8 max-w-5xl mx-auto flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">경험 뱅크</h1>
                    <p className="text-slate-500 text-base max-w-2xl">
                        나만의 경험을 체계적으로 기록하고 관리하세요. AI가 직무 역량에 맞춰 다듬어 드립니다.
                    </p>
                </div>
                {MOCK_EXPERIENCES.length > 0 && (
                    <button className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all hover:scale-105">
                        <PlusCircle size={20} /> <span>내 경험 추가</span>
                    </button>
                )}
            </div>

            <div className="flex-1 space-y-6">
                {MOCK_EXPERIENCES.length > 0 ? (
                    MOCK_EXPERIENCES.map(exp => (
                        <ExperienceCard key={exp.id} experience={exp} />
                    ))
                ) : (
                    <div className="bg-white rounded-2xl border-2 border-slate-200 border-dashed p-16 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Database size={32} className="text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">아직 내 경험이 없습니다</h3>
                        <p className="text-slate-500 mb-6 w-full max-w-sm">추가해 주세요.<br />새로운 경험을 추가해 나만의 커리어 자산을 만들어보세요.</p>
                        <button className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-md shadow-blue-600/20 hover:scale-105">
                            <PlusCircle size={20} /> <span>내 경험 추가</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function CompanyAnalysisView() {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-black text-slate-900 mb-8">Tesla Inc. 기업 분석 리포트</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatBox label="연간 매출" value="$96.7B" trend="+15%" trendColor="text-green-600" />
                <StatBox label="순이익" value="$12.6B" trend="+4%" trendColor="text-green-600" />
                <StatBox label="전년 대비 성장" value="18.3%" trend="-2%" trendColor="text-red-600" />
                <StatBox label="시가총액" value="$750B" trend="+1.5%" trendColor="text-green-600" />
            </div>
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

function ExperienceCard({ experience }: { experience: Experience }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="p-6 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">{experience.title}</h3>
                    <ChevronRight size={20} className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="px-6 pb-6 pt-2 bg-slate-50/30">
                    <p className="text-sm text-slate-700">{experience.situation}</p>
                </div>
            )}
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
