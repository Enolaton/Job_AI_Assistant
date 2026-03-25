// app/login/page.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Brain } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      toast.error('이메일 또는 비밀번호가 잘못되었습니다.');
      setError('이메일 또는 비밀번호가 일치하지 않습니다.');
      if (newAttempts >= 5) {
        router.push('/');
        return;
      }
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-8 p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-10 w-10 bg-blue-600 text-white rounded-lg mb-4">
            <Brain size={20} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bunny</h2>
          <p className="mt-1 text-slate-500 text-sm">계정에 로그인하세요</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-0.5">이메일</label>
              <input
                type="email"
                required
                placeholder="example@bunny.com"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-0.5">비밀번호</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center">
              <input id="remember-me" type="checkbox" className="h-3.5 w-3.5 text-blue-600 rounded border-slate-300" />
              <label htmlFor="remember-me" className="ml-2 text-slate-500">로그인 유지</label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm"
          >
            로그인
          </button>

          <div className="text-center text-xs text-slate-500">
            계정이 없으신가요?
            <Link href="/register">
              <span className="ml-1.5 text-blue-600 font-semibold hover:underline cursor-pointer">회원가입</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}