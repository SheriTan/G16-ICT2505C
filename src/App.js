import "./App.css";
import { useEffect, useState } from "react";
import { RouterProvider, createBrowserRouter, Navigate, Outlet } from "react-router-dom";

// utils
import SetDocumentTitle from "./utils/SetDocumentTitle";
import { AuthProvider, useAuth } from "./utils/AuthContext";

// components
import Layout from "./components/Layout";

// pages
import Landing from './pages/Landing';
import Overview from './pages/Overview';
import Profile from './pages/Profile';
import Team from "./pages/Team";

// Public route (no auth required)
const PublicRoute = () => {
  const { authenticated, loading } = useAuth();
  if (loading) return <div>Loading...</div>;

  return !authenticated ? <Outlet /> : <Navigate to='/overview' replace />;
};

// Protected route (auth required)
const ProtectedRoute = () => {
  const { authenticated, loading } = useAuth();
  if (loading) return <div>Loading...</div>;

  return authenticated ? <Outlet /> : <Navigate to="/" replace />;
};

export default function App() {
  const [teams, setTeams] = useState([]);
  const [selectedTeamID, setSelectedTeamID] = useState('');
  const API_BASE = "http://localhost:5000";

  useEffect(() => {
    refreshTeams();
  }, []);

  async function refreshTeams() {
    try {
      const res = await fetch(`${API_BASE}/api/teams`, {
        credentials: "include",
      });

      const data = await res.json();

      if (data?.success) {
        setTeams(data.teams);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const titles = {
    '/': 'Welcome Page',
    '/overview': 'Overview',
    '/team': 'Team Dashboard',
    '/profile': 'Profile Page'
  };

  const router = createBrowserRouter([
    {
      element: <PublicRoute />,
      children: [
        {
          path: '/',
          element: (
            <>
              <SetDocumentTitle titles={titles} />
              <Landing />
            </>
          )
        }
      ]
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: (
            <Layout
              api={API_BASE}
              teams={teams}
              setTeams={setTeams}
              selectedTeamID={selectedTeamID}
              setSelectedTeamID={setSelectedTeamID}
              refreshTeams={refreshTeams}
            />
          ),
          children: [
            {
              path: '/overview',
              element: (
                <>
                  <SetDocumentTitle titles={titles} />
                  <Overview />
                </>
              )
            },
            {
              path: '/team/:id',
              element: (
                <>
                  <SetDocumentTitle titles={titles} />
                  <Team api={API_BASE} teams={teams} />
                </>
              )
            },
            {
              path: '/profile',
              element: (
                <>
                  <SetDocumentTitle titles={titles} />
                  <Profile />
                </>
              )
            }
          ]
        }
      ]
    }
  ]);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}