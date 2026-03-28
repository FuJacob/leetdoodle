import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CanvasPage } from './pages/CanvasPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/canvas/:canvasId" element={<CanvasPage />} />
      </Routes>
    </BrowserRouter>
  );
}
