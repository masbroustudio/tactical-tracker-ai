import React, { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";

function App() {
  const [view, setView] = useState("landing");
  const [theme, setTheme] = useState("dark");

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

  return (
    <div className="App">
      {view === "landing" ? (
        <LandingPage 
          onEnterDashboard={() => setView("dashboard")} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />
      ) : (
        <Dashboard 
          onBackToLanding={() => setView("landing")} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />
      )}
    </div>
  );
}

export default App;
