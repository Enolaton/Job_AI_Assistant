// app/login/page.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

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
        router.push('/'); // redirect to main page after 5 failures
        return;
      }
      return;
    }

    // 로그인 성공
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 p-10 bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-blue-600 tracking-tight">Bunny</h2>
          <p className="mt-3 text-gray-500 font-medium">지능형 커리어 에이전트</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                required
                placeholder="example@bunny.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <input id="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300" />
              <label htmlFor="remember-me" className="ml-2 text-gray-600">로그인 유지</label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transform transition-all active:scale-[0.98] shadow-lg shadow-blue-200"
          >
            로그인
          </button>

          <div className="text-center text-sm text-gray-500">
            계정이 없으신가요?
            <Link href="/register">
              <span className="ml-2 text-blue-600 font-bold hover:underline cursor-pointer">회원가입</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}