<<<<<<< Updated upstream
import React, { useEffect, useMemo, useState } from "react";
=======
>>>>>>> Stashed changes
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

// Page require no auth
const PublicRoute = () => {
  const { authenticated, loading } = useAuth();
  if (loading) return <div>Loading...</div>;

  return !authenticated ? <Outlet /> : <Navigate to='/overview' replace />;
}

// Page require auth
const ProtectedRoute = () => {
  const { authenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return authenticated ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  const [teams, setTeams] = useState([]);
<<<<<<< Updated upstream
  const [platformFilter, setPlatformFilter] = useState("all"); // all | jira | github
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingDash, setLoadingDash] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  // last updated indicator
  const [lastUpdated, setLastUpdated] = useState(null);

  // -----------------------------
  // Add Team form states
  // -----------------------------
  const [newPlatform, setNewPlatform] = useState("jira");
  const [newTeamName, setNewTeamName] = useState("");
  const [newJiraBoardUrl, setNewJiraBoardUrl] = useState("");
  const [newGithubRepoUrl, setNewGithubRepoUrl] = useState("");
  const [newGithubProjectUrl, setNewGithubProjectUrl] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);

  // -----------------------------
  // Excel import states
  // -----------------------------
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // -----------------------------
  // Helpers
  // -----------------------------
  async function refreshTeams() {
    const res = await fetch(`${API_BASE}/api/teams`);
    const data = await res.json();
    if (!data?.success) throw new Error(data?.message || "Failed to load teams");

    const arr = data.teams || [];
    setTeams(arr);

    if (arr.length > 0 && !arr.some((t) => t.id === selectedTeamId)) {
      setSelectedTeamId(arr[0].id);
    }
    if (arr.length > 0 && !selectedTeamId) {
      setSelectedTeamId(arr[0].id);
    }
  }

  async function addTeam() {
    try {
      setSavingTeam(true);
      setError("");

      const payload =
        newPlatform === "jira"
          ? {
              platform: "jira",
              teamName: newTeamName,
              jiraBoardUrl: newJiraBoardUrl,
=======
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
  }

  const router = createBrowserRouter([
    {
      element: <PublicRoute />,
      children: [{
        path: '/',
        element: (
          <>
            <SetDocumentTitle titles={titles} />
            <Landing />
          </>
        )
      }]
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <Layout
            api={API_BASE}
            teams={teams}
            setTeams={setTeams}
            selectedTeamID={selectedTeamID}
            setSelectedTeamID={setSelectedTeamID}
            refreshTeams={refreshTeams}
          />,
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
                  <Team />
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
>>>>>>> Stashed changes
            }
          : {
              platform: "github",
              teamName: newTeamName,
              githubRepoUrl: newGithubRepoUrl,
              githubProjectUrl: newGithubProjectUrl,
            };

      const res = await fetch(`${API_BASE}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setTeams(data.teams);
      }
    }

    loadTeams();

    if (!selectedTeamID) return;

    async function loadDashboard() {
      setLoadingDash(true);

      const res = await fetch(
        `${API_BASE}/api/dashboard?teamId=${selectedTeamID}`
      );

      const data = await res.json();

      if (data.success) {
        setDashboard(data);
      }

      setLoadingDash(false);
    }

    loadDashboard();
  }, [selectedTeamID])

  const titles = {
    '/': 'Welcome Page',
    '/overview': 'Overview',
    '/team': 'Team Dashboard',
    '/profile': 'Profile Page'
  }

  const router = createBrowserRouter([
    {
      element: <PublicRoute />,
      children: [{
        path: '/',
        element: (
          <>
            <SetDocumentTitle titles={titles} />
            <Landing />
          </>
        )
      }]
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <Layout
          teams={teams}
          selectedTeamID={selectedTeamID}
          setSelectedTeamID={setSelectedTeamID}
          />,
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
                  <Team api={API_BASE} teams={teams}/>
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
        },
      ]
    }
  ])

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
