import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import History from './pages/History.jsx';
import Jobs from './pages/Jobs.jsx';
import Landing from './pages/Landing.jsx';
import LiveAnalysis from './pages/LiveAnalysis.jsx';
import Report from './pages/Report.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RequireAuth><Landing /></RequireAuth>} />
      <Route path="/signin" element={<AuthPage mode="signin" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
      <Route path="/jobs" element={<RequireAuth><Jobs /></RequireAuth>} />
      <Route path="/analysis/:id" element={<RequireAuth><LiveAnalysis /></RequireAuth>} />
      <Route path="/report/:id" element={<RequireAuth><Report /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { checking, token, user } = useAuth();
  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-white">
        <div className="rounded-lg border border-line bg-panel px-4 py-3 text-sm text-muted">Checking session</div>
      </div>
    );
  }
  if (!token || !user) return <Navigate to="/signin" replace />;
  return children;
}
