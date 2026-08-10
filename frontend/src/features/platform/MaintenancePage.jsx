export default function MaintenancePage({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F5F8FF] to-[#E8EEFB] px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 text-center">
        <img src="/logo.svg" alt="MySchoolPortal" className="w-12 h-12 rounded-xl mb-4 mx-auto" />
        <h1 className="text-xl font-semibold text-blue-800">We'll be right back</h1>
        <p className="text-sm text-slate-600 mt-2">
          {message || 'The system is temporarily down for maintenance. Please check back soon.'}
        </p>
      </div>
    </div>
  );
}
