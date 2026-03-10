import { type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ImportPage from "./pages/Import";
import Consultas from "./pages/Consultas";
import AppLayout from "./components/AppLayout";
import Insersao from "./pages/Insersao";
import Edicao from "./pages/Edicao";
import Modelagem from "./pages/Modelagem";
import { ThemeProvider } from "./components/ThemeProvider";
import Usuario from "./pages/Usuario";


function isAuthed() {
  return !!localStorage.getItem("token");
}

function PrivateRoute({ children }: { children: ReactNode }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/consultas" element={<PrivateRoute><Consultas /></PrivateRoute>} />
        <Route path="/import" element={<PrivateRoute><ImportPage /></PrivateRoute>} />
        <Route path="/insersao" element={<PrivateRoute><Insersao /></PrivateRoute>} />
        <Route path="/edicao" element={<PrivateRoute><Edicao /></PrivateRoute>} />
        <Route path="/modelagem" element={<PrivateRoute><Modelagem /></PrivateRoute>} />
        <Route path="/usuario" element={<PrivateRoute><Usuario /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}
