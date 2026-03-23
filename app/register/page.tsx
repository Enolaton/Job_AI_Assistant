// app/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, ArrowLeft, UserPlus, Brain } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', name: '' });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const nameRegex = /^[a-zA-Z가-힣]{1,19}$/;
    if (!nameRegex.test(formData.name)) {
      toast.error("이름은 한글 또는 영어 1~19자여야 합니다.");
      setIsLoading(false);
      return;
    }

    const email = formData.email.trim();
    const emailParts = email.split('@');

    if (emailParts.length !== 2) {
      toast.error("올바르지 않은 이메일 형식입니다.");
      setIsLoading(false);
      return;
    }

    const [emailPrefix, emailDomain] = emailParts;

    const adminRegex = /^admin\d*$/i;
    if (adminRegex.test(formData.name) || adminRegex.test(emailPrefix)) {
      toast.error("죄송합니다. 'admin'은 시스템 예약어로 사용할 수 없습니다.");
      setIsLoading(false);
      return;
    }

    const localRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
    const domainPartRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    const tldRegex = /^[a-zA-Z]{2,}$/;

    const domainLabels = emailDomain.split('.');
    const isDomainValid =
      domainLabels.length >= 2 &&
      domainLabels.every(label => domainPartRegex.test(label)) &&
      tldRegex.test(domainLabels[domainLabels.length - 1]);

    if (
      email.includes(" ") ||
      email.length > 320 ||
      emailDomain.includes("xn--") ||
      !localRegex.test(emailPrefix) ||
      !isDomainValid
    ) {
      toast.error("올바르지 않은 이메일 형식입니다.");
      setIsLoading(false);
      return;
    }

    const passwordRegex = /^[a-zA-Z0-9]{8,16}$/;
    if (!passwordRegex.test(formData.password)) {
      toast.error("비밀번호는 8~16자 사이의 영문 또는 숫자로만 구성되어야 합니다.");
      setIsLoading(false);
      return;
    }

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-10 w-10 bg-blue-600 text-white rounded-lg mb-4">
              <Brain size={20} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">계정 만들기</h2>
            <p className="mt-1 text-slate-500 text-sm">Bunny와 함께 취업 준비를 시작하세요</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-0.5">이름</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="홍길동"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-0.5">이메일 주소</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    placeholder="example@bunny.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-0.5">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    placeholder="8~16자 영문/숫자조합"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-0.5">비밀번호 확인</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    placeholder="비밀번호를 한 번 더 입력해주세요"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserPlus size={16} />
                {isLoading ? '처리 중...' : '계정 생성하기'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full py-2.5 text-slate-500 rounded-lg text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={14} />
                이미 계정이 있으신가요? <span className="text-blue-600 font-semibold">로그인</span>
              </button>
            </div>
          </form>
        </div>

        <p className="text-center mt-6 text-slate-400 text-[11px]">
          가입 시 Bunny의 <span className="text-slate-500 font-medium underline cursor-pointer">서비스 약관</span> 및 <span className="text-slate-500 font-medium underline cursor-pointer">개인정보 처리방침</span>에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}
