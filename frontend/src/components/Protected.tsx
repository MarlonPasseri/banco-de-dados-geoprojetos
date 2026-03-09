import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getToken } from "../api";

export default function Protected({ children }: { children: ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}
