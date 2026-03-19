'use client';

import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
    LayoutDashboard,
    Bell,
    Search
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { ViewType } from './dashboard.types';

// New Components
import Sidebar from './components/Sidebar';
import CompanyReportModal from './components/CompanyReportModal';
import ExperienceBankView from './components/ExperienceBankView';
import CompanyAnalysisView from './components/CompanyAnalysisView';
import MockInterviewView from './components/MockInterviewView';
import WorkspaceView from './components/WorkspaceView';

export default function DashboardClient() {
    const { data: session } = useSession();
    const [currentView, setCurrentView] = useState<ViewType>('analysis');
    const [jdUrl, setJdUrl] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [analysisResultId, setAnalysisResultId] = useState<number | null>(null);
    const [selectedJobForWorkspace, setSelectedJobForWorkspace] = useState<any>(null);

    // --- 기업 분석 리포트 관련 공용 상태 ---
    const [isCompanyReportOpen, setIsCompanyReportOpen] = useState(false);
    const [companyReportData, setCompanyReportData] = useState<any>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [reportTarget, setReportTarget] = useState({ name: '', title: '' });

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
                setJdUrl('');
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

    const handleOpenCompanyReport = async (name: string, title?: string, force: boolean = false) => {
        if (!name) {
            toast.error('회사명을 확인할 수 없습니다.');
            return;
        }

        const cleanedName = name.replace(/\(.*\)/g, '').trim();
        const displayTitle = title || '전체 직무';
        
        setReportTarget({ name: cleanedName, title: displayTitle });
        setIsCompanyReportOpen(true);

        if (companyReportData && companyReportData.companyName === cleanedName && !force) return;

        setIsLoadingReport(true);
        try {
            const res = await fetch('/api/analyze/company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: cleanedName, jobTitle: displayTitle, forceRefresh: force })
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

    const userName = session?.user?.name || '사용자';
    const userEmail = session?.user?.email || 'user@example.com';

    const renderView = () => {
        switch (currentView) {
            case 'workspace':
                return (
                    <WorkspaceView
                        onViewChange={setCurrentView}
                        onOpenCompanyReport={handleOpenCompanyReport}
                    />
                );
            case 'experience':
                return <ExperienceBankView />;
            case 'analysis':
                return (
                    <CompanyAnalysisView
                        jdUrl={jdUrl}
                        setJdUrl={setJdUrl}
                        isAnalyzing={isAnalyzing}
                        onAnalyze={handleAnalyze}
                        analysisResult={analysisResult}
                        setAnalysisResult={setAnalysisResult}
                        analysisResultId={analysisResultId}
                        setAnalysisResultId={setAnalysisResultId}
                        onNavigateToWorkspace={() => {
                            setCurrentView('workspace');
                        }}
                        onOpenCompanyReport={handleOpenCompanyReport}
                    />
                );
            case 'interview':
                return <MockInterviewView />;
            default:
                return (
                    <CompanyAnalysisView
                        jdUrl={jdUrl}
                        setJdUrl={setJdUrl}
                        isAnalyzing={isAnalyzing}
                        onAnalyze={handleAnalyze}
                        analysisResult={analysisResult}
                        setAnalysisResult={setAnalysisResult}
                        analysisResultId={analysisResultId}
                        setAnalysisResultId={setAnalysisResultId}
                        onNavigateToWorkspace={() => {
                            setCurrentView('workspace');
                        }}
                        onOpenCompanyReport={handleOpenCompanyReport}
                    />
                );
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Toaster position="top-right" />
            
            <Sidebar 
                currentView={currentView}
                setCurrentView={setCurrentView}
                userName={userName}
                userEmail={userEmail}
                signOut={signOut}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-900 capitalize">
                            {currentView === 'experience' ? '경험 뱅크' :
                                currentView === 'workspace' ? '자기소개서' :
                                    currentView === 'analysis' ? '공고 분석' :
                                        currentView === 'interview' ? 'AI 모의 면접' : 
                                            currentView === 'resumes' ? '이력서 관리' : '대시보드'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
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
                    </div>
                </header>

                <div className="flex-1 overflow-hidden">
                    {renderView()}
                </div>
            </main>

            <CompanyReportModal 
                isOpen={isCompanyReportOpen}
                onClose={() => setIsCompanyReportOpen(false)}
                isLoading={isLoadingReport}
                data={companyReportData}
                companyName={reportTarget.name}
                jobTitle={reportTarget.title}
                onRefresh={() => handleOpenCompanyReport(reportTarget.name, reportTarget.title, true)}
            />
        </div>
    );
}
