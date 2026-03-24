import React, { useState, useEffect } from 'react';
import {
    Mic,
    Brain,
    Target,
    Zap,
    ChevronRight,
    Search,
    FileText,
    CheckCircle2,
    Loader2,
    PlayCircle,
    ArrowRight,
    History,
    FileSearch,
    User,
    Sparkles,
    AlertCircle,
    Volume2,
    Calendar,
    Briefcase,
    HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

import { useSession } from 'next-auth/react';

type InterviewStep = 'READY' | 'PREVIEW' | 'COUNTDOWN' | 'INTERVIEW' | 'RESULT';

interface JDItem {
    id: number;
    companyName: string;
    jdUrl: string;
    createdAt: string;
    analysisResult: any;
}

interface IntroItem {
    id: string;
    name: string;
    companyName: string;
    jobTitle: string;
    status: string;
    lastModified: string;
}

export default function MockInterviewView() {
    const { data: session } = useSession();
    const [step, setStep] = useState<InterviewStep>('READY');
    const [jdList, setJdList] = useState<JDItem[]>([]);
    const [introList, setIntroList] = useState<IntroItem[]>([]);
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState<{ question: string, answer: string }[]>([]);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [resultData, setResultData] = useState<any>(null);
    const [countdown, setCountdown] = useState(0);

    const [isLoading, setIsLoading] = useState(true);
    const [selectedJd, setSelectedJd] = useState<JDItem | null>(null);
    const [selectedIntro, setSelectedIntro] = useState<IntroItem | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Speech Recognition
    const [recognition, setRecognition] = useState<any>(null);

    useEffect(() => {
        if (step === 'READY') {
            fetchInitialData();
        }
    }, [step]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [jdRes, introRes] = await Promise.all([
                fetch('/api/analyze/jd'),
                fetch('/api/workspace')
            ]);

            const jdData = await jdRes.json();
            const introData = await introRes.json();

            if (jdData.history) setJdList(jdData.history);
            if (introData.documents) setIntroList(introData.documents);
        } catch (error) {
            console.error('Failed to fetch interview data:', error);
            toast.error('데이터를 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recog = new SpeechRecognition();
            recog.lang = 'ko-KR';
            recog.continuous = true;
            recog.interimResults = true;

            recog.onresult = (event: any) => {
                let current = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    current += event.results[i][0].transcript;
                }
                setInterimTranscript(current);
            };

            recog.onend = () => {
                setIsRecording(false);
            };

            setRecognition(recog);
        }
    }, []);

    const speak = (text: string, onEnd?: () => void) => {
        if (typeof window === 'undefined') return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.9;
        if (onEnd) utterance.onend = onEnd;
        window.speechSynthesis.speak(utterance);
    };

    const showMicHelp = () => {
        setShowHelp(!showHelp);
    };

    const handleStartInterview = async () => {
        if (!selectedJd || !selectedIntro) {
            toast.error('공고와 자기소개서를 모두 선택해 주세요.');
            return;
        }
        setIsStarting(true);
        try {
            // 마이크 권한 미리 요청
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(track => track.stop()); // 권한만 받고 바로 종료
                }
            } catch (micError: any) {
                console.warn('Microphone permission check failed:', micError);
                toast('마이크가 꺼져있습니다');
                // 오류가 발생하게도 다음 화면으로 진행하도록 return 삭제
            }

            const res = await fetch('/api/interview/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jdId: selectedJd.id, selfIntroId: selectedIntro.id })
            });
            const data = await res.json();
            if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
                setQuestions(data.questions);
                setAnswers([]);
                setCurrentIdx(0);
                setStep('PREVIEW'); // 질문 로딩 완료 후 대기 상태
            } else {
                throw new Error(data.error || '생성된 질문이 없습니다. 다시 시도해 주세요.');
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsStarting(false);
        }
    };

    const startCountdown = () => {
        setStep('COUNTDOWN');
        setCountdown(3);

        let count = 3;
        const timer = setInterval(() => {
            count -= 1;
            if (count > 0) {
                setCountdown(count);
            } else {
                clearInterval(timer);
                startInterviewFlow(questions);
            }
        }, 1000);
    };

    const startInterviewFlow = (qs: any[]) => {
        setStep('INTERVIEW');
        const userName = session?.user?.name || "지원자";
        const company = selectedJd?.companyName || "해당 기업";

        const introMsg = `안녕하세요 ${userName}님, 지금부터 ${company} 면접을 진행하겠습니다. 준비되셨다면 첫 번째 질문을 드리겠습니다.`;

        speak(introMsg, () => {
            // 인트로 끝난 뒤 첫 질문
            setTimeout(() => {
                if (qs[0] && qs[0].question) {
                    askQuestion(qs[0].question);
                }
            }, 800);
        });
    };

    const askQuestion = (text: string) => {
        speak(text, () => {
            // 질문이 끝나면 2초 뒤 자동 녹음 시작
            setTimeout(() => {
                if (!isRecording) {
                    toggleRecording();
                }
            }, 2000);
        });
    };

    const toggleRecording = () => {
        if (!recognition) {
            toast.error('이 브라우저는 음성 인식을 지원하지 않습니다.');
            return;
        }

        if (isRecording) {
            recognition.stop();
        } else {
            setInterimTranscript('');
            recognition.start();
            setIsRecording(true);
        }
    };

    const handleNextQuestion = async () => {
        const currentAnswer = interimTranscript.trim();
        if (!currentAnswer) {
            toast.error('답변을 말씀해 주세요.');
            return;
        }

        const newAnswers = [...answers, { question: questions[currentIdx].question, answer: currentAnswer }];
        setAnswers(newAnswers);
        setInterimTranscript('');

        if (isRecording) recognition.stop();

        if (currentIdx < questions.length - 1) {
            const nextIdx = currentIdx + 1;
            setCurrentIdx(nextIdx);
            if (questions[nextIdx] && questions[nextIdx].question) {
                askQuestion(questions[nextIdx].question);
            }
        } else {
            // 면접 종료 및 평가 시작
            handleFinishInterview(newAnswers);
        }
    };

    const handleFinishInterview = async (finalAnswers: any[]) => {
        setIsLoading(true);
        setStep('RESULT');
        try {
            const res = await fetch('/api/interview/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jdId: selectedJd?.id,
                    selfIntroId: selectedIntro?.id,
                    qna: finalAnswers
                })
            });
            const data = await res.json();
            setResultData(data);
            speak("면접이 종료되었습니다. 분석 결과를 확인해 주세요.");
        } catch (error) {
            toast.error('평가 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    if (step === 'READY') {
        return (
            <div className="h-full flex flex-col bg-slate-50/50 overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-8 py-5 shrink-0">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Sparkles className="text-blue-600" size={20} /> AI 정밀 모의 면접 설정
                            </h1>
                            <p className="text-xs text-slate-500 mt-1">면접의 기반이 될 공고와 자기소개서를 선택해 주세요.</p>
                        </div>
                        <div className="flex items-center gap-3 relative">
                            {showHelp && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="absolute top-full right-0 mt-3 w-64 bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 z-[100] text-left"
                                >
                                    <p className="font-bold text-sm text-slate-900 border-b pb-2 mb-3">🎤 마이크 권한 해제 안내</p>
                                    <div className="space-y-2 text-[11px] text-slate-600 leading-relaxed font-medium">
                                        <p>1. 주소창 왼쪽의 <b>ⓘ 아이콘</b> 혹은 <b>🔒 자물쇠</b>를 클릭하세요.</p>
                                        <p>2. <b>마이크</b>를 찾아 <b>'허용'</b>으로 토글하세요.</p>
                                        <p>3. 페이지를 <b>새로고침</b>하면 AI 인터뷰가 가능해집니다!</p>
                                    </div>
                                    <button 
                                        onClick={() => setShowHelp(false)}
                                        className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl text-[10px] font-bold transition-colors"
                                    >
                                        닫기
                                    </button>
                                </motion.div>
                            )}
                            <button 
                                onClick={showMicHelp}
                                className={`p-2 rounded-lg transition-all ${showHelp ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                title="마이크 설정 도움말"
                            >
                                <HelpCircle size={20} />
                            </button>
                            <button 
                                onClick={handleStartInterview}
                                disabled={!selectedJd || !selectedIntro || isStarting}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-md shadow-blue-500/10"
                            >
                                {isStarting ? (
                                    <><Loader2 size={16} className="animate-spin" /> <span>면접 준비 중...</span></>
                                ) : (
                                    <><PlayCircle size={18} /> <span>면접 시작하기</span></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-8">
                    <div className="max-w-6xl mx-auto h-full grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">

                        {/* Selector 1: JD */}
                        <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                        <History size={16} />
                                    </div>
                                    <h2 className="font-bold text-slate-900 text-sm">타겟 공고 선택</h2>
                                </div>
                                {selectedJd && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 size={12} /> 선택됨
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {isLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                                        <Loader2 className="animate-spin" />
                                        <p className="text-xs">내역 로드 중...</p>
                                    </div>
                                ) : jdList.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-40 text-center p-10">
                                        <FileSearch size={32} className="mb-3" />
                                        <p className="text-xs font-medium">분석된 공고가 없습니다.<br />공고 분석 탭에서 분석을 진행해 주세요.</p>
                                    </div>
                                ) : jdList.map((jd) => (
                                    <div
                                        key={jd.id}
                                        onClick={() => setSelectedJd(jd)}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedJd?.id === jd.id ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors uppercase tracking-wider">
                                                {new Date(jd.createdAt).toLocaleDateString()}
                                            </span>
                                            <Briefcase size={14} className={selectedJd?.id === jd.id ? 'text-blue-500' : 'text-slate-300'} />
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-sm mb-1 truncate">{jd.companyName}</h3>
                                        <p className="text-[11px] text-slate-500 truncate">{jd.jdUrl || '직접 입력됨'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Selector 2: Self-Intro */}
                        <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <FileText size={16} />
                                    </div>
                                    <h2 className="font-bold text-slate-900 text-sm">연결 자기소개서 선택</h2>
                                </div>
                                {selectedIntro && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 size={12} /> 선택됨
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {isLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                                        <Loader2 className="animate-spin" />
                                        <p className="text-xs">목록 로드 중...</p>
                                    </div>
                                ) : introList.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-40 text-center p-10">
                                        <FileText size={32} className="mb-3" />
                                        <p className="text-xs font-medium">작성된 자기소개서가 없습니다.<br />자기소개서 탭에서 새로운 문서를 만들어 보세요.</p>
                                    </div>
                                ) : introList.map((intro) => (
                                    <div
                                        key={intro.id}
                                        onClick={() => setSelectedIntro(intro)}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedIntro?.id === intro.id ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-500 transition-colors uppercase tracking-wider">
                                                {intro.status}
                                            </span>
                                            <FileText size={14} className={selectedIntro?.id === intro.id ? 'text-emerald-500' : 'text-slate-300'} />
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-sm mb-1 truncate">{intro.name}</h3>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">{intro.companyName}</span>
                                            <span className="text-[10px] text-slate-400">· {intro.jobTitle || '직무 미지정'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Selection Info */}
                <AnimatePresence>
                    {(selectedJd || selectedIntro) && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            className="bg-white border-t border-slate-200 p-6 z-10"
                        >
                            <div className="max-w-4xl mx-auto flex items-center justify-center gap-12">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-all ${selectedJd ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                        <Briefcase size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Selected Company</p>
                                        <p className={`text-sm font-bold truncate ${selectedJd ? 'text-slate-900' : 'text-slate-300'}`}>
                                            {selectedJd ? selectedJd.companyName : '공고를 선택해 주세요'}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="text-slate-200" size={24} />
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-all ${selectedIntro ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                                        <FileText size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Connected Document</p>
                                        <p className={`text-sm font-bold truncate ${selectedIntro ? 'text-slate-900' : 'text-slate-300'}`}>
                                            {selectedIntro ? selectedIntro.name : '자기소개서를 선택해 주세요'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    if (step === 'PREVIEW') {
        const userName = session?.user?.name || "지원자";
        return (
            <div className="h-full flex flex-col bg-slate-900 text-white relative overflow-hidden">
                {/* 상단 뒤로가기 및 도움말 버튼 */}
                <div className="absolute top-10 left-6 flex items-center gap-3">
                    <button
                        onClick={() => setStep('READY')}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all font-bold text-sm"
                    >
                        <ArrowRight className="rotate-180" size={18} /> 뒤로가기
                    </button>
                    <div className="relative">
                        {showHelp && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="absolute top-full left-0 mt-3 w-60 bg-slate-800 border border-white/10 shadow-2xl rounded-2xl p-5 z-[100] text-left backdrop-blur-xl"
                            >
                                <p className="font-bold text-sm text-white border-b border-white/10 pb-2 mb-3">🎤 마이크 권한 안내</p>
                                <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed font-medium">
                                    <p>1. 주소창 왼쪽의 <b>ⓘ 아이콘</b>을 클릭하세요.</p>
                                    <p>2. <b>마이크</b>를 찾아 <b>'허용'</b>으로 변경하세요.</p>
                                    <p>3. 완료 후 <b>새로고침</b>을 하시면 됩니다!</p>
                                </div>
                                <button 
                                    onClick={() => setShowHelp(false)}
                                    className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[10px] font-bold transition-colors"
                                >
                                    닫기
                                </button>
                            </motion.div>
                        )}
                        <button 
                            onClick={showMicHelp}
                            className={`p-2 rounded-xl transition-all ${showHelp ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}`}
                            title="마이크 설정 도움말"
                        >
                            <HelpCircle size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-12">
                    <div className="max-w-2xl w-full text-center space-y-8">
                        <div className="mx-auto w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/30">
                            <CheckCircle2 size={40} className="text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold mb-4">{userName}님, 면접 준비가 완료되었습니다.</h2>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                선택하신 공고와 자기소개서를 바탕으로 개인 맞춤형 질문 구성을 마쳤습니다.<br />
                                시작 버튼을 누르면 카운트다운과 함께 면접이 시작됩니다.
                            </p>
                        </div>
                        <div className="pt-8">
                            <button
                                onClick={startCountdown}
                                className="group flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-500/20 mx-auto"
                            >
                                면접 시작 <PlayCircle className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'COUNTDOWN') {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white">
                <motion.div
                    key={countdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-7xl font-black text-blue-500"
                >
                    {countdown}
                </motion.div>
                <div className="mt-12 flex flex-col items-center">
                    <Loader2 className="animate-spin text-slate-700 mb-3" size={24} />
                    <p className="text-slate-500 font-bold tracking-widest uppercase text-[10px]">면접장을 구성하고 있습니다...</p>
                </div>
            </div>
        );
    }

    if (step === 'INTERVIEW') {
        const currentQ = questions[currentIdx];
        return (
            <div className="h-full flex flex-col bg-slate-900 text-white overflow-hidden">
                <div className="h-1 bg-slate-800">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                        className="h-full bg-blue-500"
                    />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                    <div className="absolute top-10 left-6 flex items-center gap-3">
                        <button
                            onClick={() => setStep('READY')}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all font-bold text-sm"
                        >
                            <ArrowRight className="rotate-180" size={18} /> 뒤로가기
                        </button>
                        <div className="relative">
                            {showHelp && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="absolute top-full left-0 mt-3 w-60 bg-slate-800 border border-white/10 shadow-2xl rounded-2xl p-5 z-[100] text-left backdrop-blur-xl"
                                >
                                    <p className="font-bold text-sm text-white border-b border-white/10 pb-2 mb-3">🎤 마이크 권한 안내</p>
                                    <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed font-medium">
                                        <p>1. 주소창 왼쪽의 <b>ⓘ 아이콘</b>을 클릭하세요.</p>
                                        <p>2. <b>마이크</b>를 찾아 <b>'허용'</b>으로 변경하세요.</p>
                                        <p>3. 완료 후 <b>새로고침</b>을 하시면 됩니다!</p>
                                    </div>
                                    <button 
                                        onClick={() => setShowHelp(false)}
                                        className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[10px] font-bold transition-colors"
                                    >
                                        닫기
                                    </button>
                                </motion.div>
                            )}
                            <button 
                                onClick={showMicHelp}
                                className={`p-2 rounded-xl transition-all ${showHelp ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}`}
                                title="마이크 설정 도움말"
                            >
                                <HelpCircle size={18} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-tighter">
                            <span className="text-blue-500">Q{currentIdx + 1}</span> <span className="opacity-20">/</span> {questions.length} Questions
                        </div>
                    </div>

                    {/* 이동된 다음 질문 버튼 */}
                    <div className="absolute top-10 right-6">
                        <button
                            onClick={handleNextQuestion}
                            disabled={!interimTranscript && !isRecording}
                            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 ${!interimTranscript && !isRecording
                                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {currentIdx === questions.length - 1 ? "면접 종료" : "다음 질문"} <ArrowRight size={18} />
                        </button>
                    </div>

                    <div className="max-w-2xl w-full space-y-8 text-center text-slate-200">
                        <div className="flex items-center justify-center gap-3 text-blue-500 mb-6">
                            <Volume2 size={20} className={isRecording ? "" : "animate-pulse"} />
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                                {isRecording ? "답변을 듣고 있습니다..." : "AI 면접관이 질문 중입니다"}
                            </span>
                        </div>

                        <motion.h2
                            key={currentIdx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl font-bold leading-tight min-h-[100px]"
                        >
                            "{currentQ?.question || '질문을 생성 중입니다...'}"
                        </motion.h2>

                        <div className="min-h-[100px] flex items-center justify-center">
                            <p className="text-xl text-blue-300/80 font-medium italic">
                                {interimTranscript || (isRecording ? "말씀해 주세요..." : "")}
                            </p>
                        </div>

                        <div className="pt-10 flex flex-col items-center gap-6">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={toggleRecording}
                                className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center shadow-lg transition-all ${isRecording ? 'bg-rose-500 shadow-rose-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}
                            >
                                <Mic size={24} className={isRecording ? "animate-pulse" : ""} />
                            </motion.button>
                            <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">
                                {isRecording ? "답변을 끝내려면 누르세요" : "버튼을 눌러 답변 시작"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
                    <div className="max-w-2xl mx-auto flex items-center justify-center">
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={14} className="text-blue-500" /> AI Mock Interview System v1.5
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'RESULT') {
        return (
            <div className="h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
                <div className="flex-1 max-w-5xl mx-auto w-full p-12 space-y-8">
                    {isLoading ? (
                        <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
                            <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-slate-900 mb-2">AI 정밀 분석 중...</h3>
                                <p className="text-slate-500">답변의 일관성과 직무 적합성을 검토하고 있습니다.</p>
                            </div>
                        </div>
                    ) : resultData ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            <header className="flex items-end justify-between">
                                <div>
                                    <span className="text-blue-600 font-bold text-xs tracking-widest uppercase">Report</span>
                                    <h2 className="text-3xl font-bold text-slate-900 mt-1">면접 분석 결과</h2>
                                </div>
                                <button onClick={() => setStep('READY')} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">메인으로 돌아가기</button>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-slate-900 rounded-2xl p-8 text-white md:col-span-1 shadow-xl">
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-6">종합 일관성 점수</p>
                                    <div className="text-6xl font-black text-blue-400 mb-4">{resultData.score || '85'}</div>
                                    <p className="text-sm text-slate-400 leading-relaxed">자소서와 이력서 데이터 대비 답변의 정합성이 높은 수준입니다.</p>
                                </div>

                                <div className="md:col-span-2 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                                                <CheckCircle2 size={14} className="text-emerald-500" /> 핵심 강점
                                            </h4>
                                            <ul className="space-y-3">
                                                {(resultData.strengths || ["직무 전문성 우수", "논리적 답변 구조"]).map((s: string, i: number) => (
                                                    <li key={i} className="text-sm font-semibold text-slate-700 flex gap-2">
                                                        <span className="text-emerald-500">·</span> {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                                                <AlertCircle size={14} className="text-rose-500" /> 보완할 점
                                            </h4>
                                            <ul className="space-y-3">
                                                {(resultData.weaknesses || ["일부 경험 수치 부족", "협업 상황 구체성 보완"]).map((w: string, i: number) => (
                                                    <li key={i} className="text-sm font-semibold text-slate-700 flex gap-2">
                                                        <span className="text-rose-500">·</span> {w}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl">
                                        <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2">
                                            <Zap size={14} /> AI 전략 제안
                                        </h4>
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                            {resultData.feedback || "전반적으로 우수합니다. 다음 면접에서는 '데이터 기반 성과'를 좀 더 수치로 강조해 보세요."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : null}
                </div>
            </div>
        );
    }

    return null;
}
