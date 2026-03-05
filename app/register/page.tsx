// app/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, ArrowLeft, UserPlus, Brain } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', name: '' });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // 1. 이름 검증: 한글/영어 1~9자
    const nameRegex = /^[a-zA-Z가-힣]{1,9}$/;
    if (!nameRegex.test(formData.name)) {
      toast.error("이름은 한글 또는 영어 1~9자 이하여야 합니다.");
      setIsLoading(false);
      return;
    }

    // 2. 이메일 검증
    const email = formData.email.trim();
    const emailParts = email.split('@');

    if (emailParts.length !== 2) {
      toast.error("올바르지 않은 이메일 형식입니다.");
      setIsLoading(false);
      return;
    }

    const [emailPrefix, emailDomain] = emailParts;

    // admin 사용 제한
    const adminRegex = /^admin\d*$/i;
    if (adminRegex.test(formData.name) || adminRegex.test(emailPrefix)) {
      toast.error("죄송합니다. 'admin'은 시스템 예약어로 사용할 수 없습니다.");
      setIsLoading(false);
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // 도메인 부분에 대문자가 포함되어 있는지 확인 (사용자 요청: 도메인은 소문자여야 함)
    const hasUpperCaseInDomain = /[A-Z]/.test(emailDomain);

    if (
      !emailRegex.test(email) ||
      email.includes("..") ||
      emailDomain.startsWith(".") ||
      email.includes(" ") ||
      email.length > 320 ||
      hasUpperCaseInDomain
    ) {
      toast.error("올바르지 않은 이메일 형식입니다.");
      setIsLoading(false);
      return;
    }

    // 3. 비밀번호 검증
    const passwordRegex = /^[a-zA-Z0-9]{8,16}$/;
    if (!passwordRegex.test(formData.password)) {
      toast.error("비밀번호는 8~16자 사이의 영문 또는 숫자로만 구성되어야 합니다.");
      setIsLoading(false);
      return;
    }

    // 4. 비밀번호 확인 체크
    if (formData.password !== formData.confirmPassword) {
      toast.error("비밀번호가 서로 일치하지 않습니다. 다시 확인해주세요.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success("반가워요! 회원가입이 성공적으로 완료되었습니다.");
        setTimeout(() => router.push('/login'), 1500);
      } else {
        const data = await res.json();
        toast.error(data.message || "이미 등록된 이메일이거나 서버 오류가 발생했습니다.");
      }
    } catch (error) {
      toast.error("현재 서버와 통신이 원활하지 않습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-3xl"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-3xl"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="bg-white p-10 rounded-3xl shadow-2xl shadow-blue-900/5 border border-slate-100 relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/30 mb-6">
              <Brain size={32} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bunny 시작하기</h2>
            <p className="mt-2 text-slate-500 font-medium text-sm">지능형 커리어 에이전트와 함께하세요</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5" noValidate>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">이름</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="홍길동"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">이메일 주소</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <input
                    type="email"
                    placeholder="example@bunny.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300"
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">비밀번호</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="8~16자 영문/숫자조합"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300"
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">비밀번호 확인</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="비밀번호를 한 번 더 입력해주세요"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300"
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserPlus size={20} />
                {isLoading ? '처리 중...' : '계정 생성하기'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full py-4 bg-white text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft size={18} />
                이미 계정이 있으신가요? 로그인
              </button>
            </div>
          </form>
        </div>

        <p className="text-center mt-8 text-slate-400 text-xs">
          가입 시 Bunny의 <span className="text-slate-500 font-bold underline cursor-pointer">서비스 약관</span> 및 <span className="text-slate-500 font-bold underline cursor-pointer">개인정보 처리방침</span>에 동의하게 됩니다.
        </p>
      </motion.div>
    </div>
  );
}
