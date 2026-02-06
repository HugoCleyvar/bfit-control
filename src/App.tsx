import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './logic/authContext';
import { ShiftProvider } from './logic/shiftContext';
import { ProtectedRoute } from './ui/components/ProtectedRoute';
import { MainLayout } from './ui/layouts/MainLayout';

// Lazy load pages for code-splitting
const Login = lazy(() => import('./ui/pages/Login'));
const Dashboard = lazy(() => import('./ui/pages/Dashboard'));
const Members = lazy(() => import('./ui/pages/Members'));
const Attendance = lazy(() => import('./ui/pages/Attendance'));
const Payments = lazy(() => import('./ui/pages/Payments'));
const CashRegister = lazy(() => import('./ui/pages/CashRegister'));
const Reports = lazy(() => import('./ui/pages/Reports'));
const Plans = lazy(() => import('./ui/pages/Plans'));
const Settings = lazy(() => import('./ui/pages/Settings'));
const Products = lazy(() => import('./ui/pages/Products'));

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: 'var(--color-text-secondary)'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div className="spinner" style={{
        width: '40px',
        height: '40px',
        border: '3px solid var(--color-border)',
        borderTop: '3px solid var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 16px'
      }} />
      Cargando...
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ShiftProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route index element={
                  <ProtectedRoute allowedRoles={['admin', 'colaborador']}>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="members" element={<Members />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="payments" element={<Payments />} />
                <Route path="shifts" element={<CashRegister />} />
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
                <Route path="settings" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="products" element={
                  <ProtectedRoute allowedRoles={['admin', 'colaborador']}>
                    <Products />
                  </ProtectedRoute>
                } />
              </Route>

              <Route path="/shifts" element={
                <ProtectedRoute allowedRoles={['admin', 'colaborador']}>
                  <CashRegister />
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ShiftProvider>
    </AuthProvider>
  );
}

export default App;

