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
        <p className="max-w-6xl mx-auto px-6 py-4 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} MySchoolPortal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
