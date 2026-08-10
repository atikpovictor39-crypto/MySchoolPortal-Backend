import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-12 grid gap-10 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <img src="/logo.svg" alt="MySchoolPortal" className="w-10 h-10 rounded-lg shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">MySchoolPortal</p>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Built by Victor, a Ghana-based developer who set out to give schools an affordable, all-in-one
              way to manage students, fees, attendance and communication without expensive software or
              paperwork.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Get in touch</p>
          <p className="text-sm text-slate-600 mt-2">
            Questions, feedback or a feature request? I read every email.
          </p>
          <a
            href="mailto:atikpovictor39@gmail.com"
            className="inline-block mt-2 text-sm font-medium text-blue-600 hover:underline"
          >
            atikpovictor39@gmail.com
          </a>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} MySchoolPortal. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-slate-500">
            <Link to="/privacy" className="hover:text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-blue-600 hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
