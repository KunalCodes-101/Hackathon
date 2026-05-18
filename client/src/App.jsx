import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import LiveAnalysis from './pages/LiveAnalysis.jsx';
import Report from './pages/Report.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/analysis/:id" element={<LiveAnalysis />} />
      <Route path="/report/:id" element={<Report />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
