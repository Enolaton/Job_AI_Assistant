// app/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      alert("회원가입이 완료되었습니다. 로그인해주세요.");
      router.push('/login'); // 로그인 페이지로 이동
    } else {
      alert("회원가입에 실패했습니다.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">Bunny 회원가입</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="이름"
            className="w-full p-3 border rounded-md"
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
          />
          <input
            type="email"
            placeholder="이메일 주소"
            className="w-full p-3 border rounded-md"
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            className="w-full p-3 border rounded-md"
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
          <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700">
            계정 생성하기
          </button>
        </form>
      </div>
    </div>
  );
}