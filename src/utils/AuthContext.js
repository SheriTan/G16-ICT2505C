import { createContext, useContext, useEffect, useState } from "react";
import API from "../utils/API";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await API.get("/session");
      setAuthenticated(true);
      setUser(res.data.user);
      return res.data;
    } catch {
      setAuthenticated(false);
      setUser(null);
      return null;
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

  const getProfile = async () => {
    const res = await API.get("/profile");
    setUser(res.data);
    return res.data;
  };

  const updateProfile = async (data) => {
    await API.put("/profile", data);
    return getProfile();
  };

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, register, logout, getProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);