// app/page.tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <div className="text-center space-y-6">
        {/* 서비스 로고 및 이름 */}
        <h1 className="text-6xl font-black text-blue-600 tracking-tighter">Bunny</h1>
        
        {/* 서비스 슬로건 (기획서 내용 반영) */}
        <p className="text-xl text-gray-600 font-medium">
          데이터와 경험을 잇는 Intelligent Bridge
        </p>
        
        <div className="pt-8">
          {/* 로그인 페이지로 이동하는 버튼 */}
          <Link href="/login">
            <button className="px-10 py-4 bg-blue-600 text-white rounded-full font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 transform active:scale-95">
              에이전트 시작하기
            </button>
          </Link>
        </div>
      </div>
      
      {/* 하단 푸터 */}
      <footer className="absolute bottom-10 text-gray-400 text-sm">
        © 2026 Bunny: Data-Driven Career Intelligence
      </footer>
    </div>
  );
}