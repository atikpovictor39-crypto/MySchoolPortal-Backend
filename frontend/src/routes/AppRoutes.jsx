import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../features/auth/LoginPage';
import SignupPage from '../features/auth/SignupPage';
import AppShell from '../components/layout/AppShell';
import SchoolsPage from '../pages/superadmin/SchoolsPage';
import DashboardPage from '../pages/schooladmin/DashboardPage';
import AcademicYearsPage from '../pages/schooladmin/AcademicYearsPage';
import ClassesPage from '../pages/schooladmin/ClassesPage';
import StudentsPage from '../pages/schooladmin/StudentsPage';
import SubjectsPage from '../pages/schooladmin/SubjectsPage';
import TeachersPage from '../pages/schooladmin/TeachersPage';
import ClockInPage from '../pages/schooladmin/ClockInPage';
import LeaveRequestsPage from '../pages/schooladmin/LeaveRequestsPage';
import TimetablePage from '../pages/schooladmin/TimetablePage';
import HomeworkPage from '../pages/schooladmin/HomeworkPage';
import ResultsPage from '../pages/schooladmin/ResultsPage';
import AttendancePage from '../pages/schooladmin/AttendancePage';
import FeesPage from '../pages/schooladmin/FeesPage';
import AnnouncementsPage from '../pages/schooladmin/AnnouncementsPage';
import OverviewPage from '../pages/parent/OverviewPage';
import ParentResultsPage from '../pages/parent/ParentResultsPage';
import ParentAttendancePage from '../pages/parent/ParentAttendancePage';
import ParentFeesPage from '../pages/parent/ParentFeesPage';
import ParentTimetablePage from '../pages/parent/ParentTimetablePage';
import ParentAnnouncementsPage from '../pages/parent/ParentAnnouncementsPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<SignupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/academic-years" element={<AcademicYearsPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/clock-in" element={<ClockInPage />} />
          <Route path="/leave-requests" element={<LeaveRequestsPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/homework" element={<HomeworkPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/parent-results" element={<ParentResultsPage />} />
          <Route path="/parent-attendance" element={<ParentAttendancePage />} />
          <Route path="/parent-fees" element={<ParentFeesPage />} />
          <Route path="/parent-timetable" element={<ParentTimetablePage />} />
          <Route path="/parent-announcements" element={<ParentAnnouncementsPage />} />
          <Route path="/schools" element={<SchoolsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
