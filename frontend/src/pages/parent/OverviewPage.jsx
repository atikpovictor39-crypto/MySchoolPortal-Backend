import { useEffect, useState } from 'react';
import { useParent } from '../../context/ParentContext';
import ChildTabs from '../../components/parent/ChildTabs';
import StatCard from '../../components/common/StatCard';
import { AttendanceIcon, ChartIcon, StarIcon, DollarIcon } from '../../components/common/icons';
import { getChildOverview, listAnnouncements } from '../../features/parent/api';
import { formatMoney } from '../../utils/money';

function initials(first, last) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
}

function ordinal(n) {
  if (n === null || n === undefined) return '—';
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function attendanceColor(rate) {
  if (rate === null) return 'text-slate-900';
  if (rate >= 90) return 'text-green-600';
  if (rate >= 75) return 'text-amber-600';
  return 'text-red-600';
}

function averageColor(avg) {
  if (avg === null) return 'text-slate-900';
  if (avg >= 80) return 'text-green-600';
  if (avg >= 60) return 'text-amber-600';
  return 'text-red-600';
}

const FEE_STATUS_STYLE = {
  paid: 'bg-green-50 text-green-700 border-green-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-red-50 text-red-700 border-red-200',
  none: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function OverviewPage() {
  const { childList, selectedChild, selectedChildId, isLoading: isLoadingChildren, error: childrenError } = useParent();

  const [overview, setOverview] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedChildId) return;
    setIsLoading(true);
    setError('');
    Promise.all([getChildOverview(selectedChildId), listAnnouncements()])
      .then(([overviewData, announcementList]) => {
        setOverview(overviewData);
        setAnnouncements(announcementList);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load overview'))
      .finally(() => setIsLoading(false));
  }, [selectedChildId]);

  if (isLoadingChildren) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {selectedChild
            ? `A snapshot of ${selectedChild.first_name}'s attendance, results, and fees.`
            : "A snapshot of your child's attendance, results, and fees."}
        </p>
      </div>

      {(childrenError || error) && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {childrenError || error}
        </p>
      )}

      {childList.length === 0 ? (
        <p className="text-sm text-slate-500">
          No children are linked to your account yet — ask your school's admin to add you as a guardian.
        </p>
      ) : (
        <>
          <ChildTabs />

          {selectedChild && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 mb-6 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-semibold shrink-0">
                {initials(selectedChild.first_name, selectedChild.last_name)}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {selectedChild.first_name} {selectedChild.last_name}
                </p>
                <p className="text-sm text-slate-500">
                  {selectedChild.class_name}
                  {selectedChild.section ? ` ${selectedChild.section}` : ''} · Admission No. {selectedChild.admission_no}
                </p>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            overview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={<AttendanceIcon />}
                  iconBg="bg-sky-500"
                  label="Attendance Rate"
                  value={overview.attendanceRate !== null ? `${overview.attendanceRate}%` : '—'}
                  valueColor={attendanceColor(overview.attendanceRate)}
                />
                <StatCard
                  icon={<ChartIcon />}
                  iconBg="bg-violet-500"
                  label="Class Average"
                  value={overview.classAverage !== null ? overview.classAverage : '—'}
                  valueColor={averageColor(overview.classAverage)}
                  sublabel={overview.latestExam ? overview.latestExam.name : undefined}
                />
                <StatCard
                  icon={<StarIcon />}
                  iconBg="bg-amber-500"
                  label="Class Position"
                  value={ordinal(overview.position)}
                  sublabel={overview.classSize ? `out of ${overview.classSize} students` : undefined}
                />
                <StatCard
                  icon={<DollarIcon />}
                  iconBg="bg-emerald-500"
                  label="Fee Balance"
                  value={formatMoney(overview.feeBalanceCents)}
                  extra={
                    overview.feeStatus !== 'none' && (
                      <span
                        className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${FEE_STATUS_STYLE[overview.feeStatus]}`}
                      >
                        {overview.feeStatus}
                      </span>
                    )
                  }
                />
              </div>
            )
          )}

          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Latest Announcements</h2>
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-500">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.slice(0, 5).map((a) => (
                  <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                      <span>{a.published_at.slice(0, 10)}</span>
                      <span>·</span>
                      <span>{a.created_by_name}</span>
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium capitalize">
                        {a.target_role}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{a.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{a.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
