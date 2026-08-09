import { Link } from 'react-router-dom';
import Footer from '../../components/layout/Footer';
import DashboardPreview from './DashboardPreview';
import {
  UsersIcon,
  DollarIcon,
  AttendanceIcon,
  ChartIcon,
  DeviceIcon,
  BellIcon,
} from '../../components/common/icons';

const FEATURES = [
  {
    icon: UsersIcon,
    title: 'Students, classes & staff',
    description: 'Manage enrollment, classes, subjects and teachers in one place, organized by academic year.',
  },
  {
    icon: DollarIcon,
    title: 'Fees & payments',
    description:
      'Share your Mobile Money and bank details, let parents self-report payments, and confirm or reject claims from one queue.',
  },
  {
    icon: AttendanceIcon,
    title: 'Attendance tracking',
    description: 'Take daily attendance in seconds and keep an accurate, auditable record for every class.',
  },
  {
    icon: ChartIcon,
    title: 'Results & report cards',
    description: 'Record exam scores by subject and generate clean, printable report cards for every student.',
  },
  {
    icon: DeviceIcon,
    title: 'Parent portal on any device',
    description: "Parents get their own mobile-friendly login to see grades, attendance, fees and timetables in real time.",
  },
  {
    icon: BellIcon,
    title: 'Announcements & alerts',
    description: 'Post school-wide announcements and send push notifications the moment something needs attention.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="MySchoolPortal" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-blue-800">MySchoolPortal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-blue-700">
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <header className="bg-gradient-to-b from-[#F5F8FF] to-white px-6 py-20 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-800 max-w-2xl mx-auto leading-tight">
          Run your school without the spreadsheets and paper files
        </h1>
        <p className="text-slate-600 mt-4 max-w-xl mx-auto">
          MySchoolPortal brings students, fees, attendance, results and parent communication into one clean,
          affordable dashboard built for schools in Ghana and beyond.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/register"
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Start your free trial
          </Link>
          <Link
            to="/login"
            className="rounded-md bg-white border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
          >
            Sign in
          </Link>
        </div>

        <p className="text-xs text-slate-500 mt-6">
          Not ready to sign up? Explore a live demo — no account needed:{' '}
          <Link to="/login?demo=admin" className="text-blue-600 font-medium hover:underline">
            as a school admin
          </Link>{' '}
          or{' '}
          <Link to="/login?demo=parent" className="text-blue-600 font-medium hover:underline">
            as a parent
          </Link>
        </p>

        <div className="max-w-3xl mx-auto mt-12">
          <DashboardPreview />
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-white rounded-xl border border-slate-100 shadow-md p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Icon />
              </div>
              <p className="text-sm font-semibold text-slate-900 mt-4">{title}</p>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-b from-white to-[#F5F8FF] px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold text-blue-800">Ready to see it running your school?</h2>
        <p className="text-slate-600 mt-2">Set up your school and its first admin account in under two minutes.</p>
        <Link
          to="/register"
          className="inline-block mt-6 rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          Start your free trial
        </Link>
      </section>

      <Footer />
    </div>
  );
}
