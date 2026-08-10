import { Link } from 'react-router-dom';

export default function LegalPageLayout({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="MySchoolPortal" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-blue-800">MySchoolPortal</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-blue-800">{title}</h1>
        <p className="text-sm text-slate-500 mt-1 mb-8">Last updated: {updated}</p>

        <div className="text-sm text-slate-700 leading-relaxed space-y-6">{children}</div>

        <p className="text-sm text-slate-500 mt-12 pt-6 border-t border-slate-100">
          Questions? Reach out at{' '}
          <a href="mailto:atikpovictor39@gmail.com" className="text-blue-600 hover:underline">
            atikpovictor39@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
