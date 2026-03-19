import React from 'react';
import { 
    LayoutDashboard, 
    Database, 
    FileSearch, 
    Edit3, 
    Mic, 
    Settings, 
    HelpCircle, 
    LogOut, 
    Brain, 
    UserCircle,
    ChevronLeft,
    ChevronRight,
    FileText
} from 'lucide-react';

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    collapsed?: boolean;
    className?: string;
}

function NavItem({ icon, label, active, onClick, collapsed, className }: NavItemProps) {
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

interface SidebarProps {
    currentView: string;
    setCurrentView: (view: any) => void;
    userName: string;
    userEmail: string;
    signOut: (options: any) => void;
}

export default function Sidebar({
    currentView,
    setCurrentView,
    userName,
    userEmail,
    signOut
}: SidebarProps) {
    return (
        <aside className="bg-white border-r border-slate-200 flex flex-col w-56">
            <div className="p-6 flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-600/10 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <Brain size={24} />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">JobAI Assist</h1>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar pt-4">
                <div className="px-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">메뉴</div>
                <NavItem 
                    icon={<FileSearch size={20} />} 
                    label="공고 분석" 
                    active={currentView === 'analysis'} 
                    onClick={() => setCurrentView('analysis')} 
                />
                <NavItem 
                    icon={<Database size={20} />} 
                    label="내 경험 뱅크" 
                    active={currentView === 'experience'} 
                    onClick={() => setCurrentView('experience')} 
                />
                <NavItem 
                    icon={<Edit3 size={20} />} 
                    label="자기소개서" 
                    active={currentView === 'workspace'} 
                    onClick={() => setCurrentView('workspace')} 
                />
                <NavItem 
                    icon={<Mic size={20} />} 
                    label="AI 모의 면접" 
                    active={currentView === 'interview'} 
                    onClick={() => setCurrentView('interview')} 
                />

                <div className="pt-8">
                    <div className="px-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">계정</div>
                    <NavItem icon={<Settings size={20} />} label="설정" />
                    <NavItem icon={<HelpCircle size={20} />} label="고객지원" />
                    <NavItem
                        icon={<LogOut size={20} />}
                        label="로그아웃"
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
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{userName}</p>
                        <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
