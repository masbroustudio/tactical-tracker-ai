import React, { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import AuthPage from "./components/AuthPage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, useFirebase } from "./firebase";

function App() {
  const [view, setView] = useState("landing");
  const [theme, setTheme] = useState("dark");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(useFirebase);

  // Monitor auth state if Firebase is enabled
  useEffect(() => {
    if (!useFirebase) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light-theme");
    } else {
      document.documentElement.classList.remove("light-theme");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleEnterDashboard = () => {
    if (useFirebase && !user) {
      setView("auth");
    } else {
      setView("dashboard");
    }
  };

  const handleLogout = async () => {
    if (useFirebase) {
      try {
        await signOut(auth);
        setUser(null);
        setView("landing");
      } catch (err) {
        console.error("Sign out failed:", err);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="auth-container dark-theme">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", fontFamily: "Outfit, sans-serif" }}>Verifying Credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {view === "landing" && (
        <LandingPage 
          onEnterDashboard={handleEnterDashboard} 
          theme={theme} 
          toggleTheme={toggleTheme} 
          user={user}
          onLogout={handleLogout}
        />
      )}

      {view === "auth" && (
        <AuthPage
          onBack={() => setView("landing")}
          onSuccess={() => setView("dashboard")}
          theme={theme}
        />
      )}

      {view === "dashboard" && (
        <Dashboard 
          onBackToLanding={() => setView("landing")} 
          theme={theme} 
          toggleTheme={toggleTheme} 
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
