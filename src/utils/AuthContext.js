import { createContext, useContext, useEffect, useState } from "react";
import API from "../utils/API";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      await API.get("/session"); // backend checks cookie/session
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email) => {
    await API.post("/login", { email });
    setAuthenticated(true);
  };

  const register = async (email, jiraToken, githubToken) => {
    await API.post("/register", { email, jiraToken, githubToken });
    setAuthenticated(true);
  };

  const logout = async () => {
    await API.post("/logout");
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);