import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './logic/authContext';
import { ProtectedRoute } from './ui/components/ProtectedRoute';
import { MainLayout } from './ui/layouts/MainLayout';
import Login from './ui/pages/Login';
import Dashboard from './ui/pages/Dashboard';
import Members from './ui/pages/Members';
import Attendance from './ui/pages/Attendance';
import Payments from './ui/pages/Payments';
import Shifts from './ui/pages/Shifts';
import Reports from './ui/pages/Reports';
import Plans from './ui/pages/Plans';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="members" element={<Members />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="payments" element={<Payments />} />
            <Route path="shifts" element={<Shifts />} />
            <Route path="reports" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="plans" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Plans />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
