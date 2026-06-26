import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";
import { Mail, Lock, LogIn, UserPlus, ArrowLeft, AlertCircle, Shield } from "lucide-react";

export default function AuthPage({ onBack, onSuccess, theme }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      // Map Firebase errors to user friendly messages
      switch (err.code) {
        case "auth/invalid-email":
          setError("Invalid email format.");
          break;
        case "auth/user-disabled":
          setError("This user account has been disabled.");
          break;
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Incorrect email or password.");
          break;
        case "auth/email-already-in-use":
          setError("This email is already registered.");
          break;
        case "auth/weak-password":
          setError("Password should be at least 6 characters.");
          break;
        default:
          setError(err.message || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onSuccess();
    } catch (err) {
      console.error(err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google Sign-In failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-container ${theme}-theme`}>
      <div className="auth-card glass-panel animate-fade-in">
        {/* Back Button */}
        <button className="auth-back-btn" onClick={onBack} title="Back to Landing Page">
          <ArrowLeft size={16} /> Back
        </button>

        {/* Title */}
        <div className="auth-header">
          <div className="logo-icon logo-glow">T</div>
          <h2>{isSignUp ? "Create Coach Account" : "Access Tactical Dashboard"}</h2>
          <p className="auth-subtitle">
            {isSignUp 
              ? "Sign up to configure matches, simulate scenarios, and access AI coaching staff." 
              : "Sign in to access real-time momentum tracking and Gemini tactical suggestions."
            }
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleEmailAuth} className="auth-form">
          <div className="input-group-field">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="email"
                type="email"
                placeholder="coach@team.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-group-field">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                {isSignUp ? <UserPlus size={16} /> : <LogIn size={16} />}
                {isSignUp ? "Sign Up" : "Sign In"}
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* Google Login Button */}
        <button 
          onClick={handleGoogleAuth} 
          className="auth-google-btn" 
          disabled={loading}
          type="button"
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99C6.18 7.02 8.87 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.02 3.67-8.64z"
            />
            <path
              fill="#FBBC05"
              d="M5.24 14.81c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31L1.39 7.2C.5 8.94 0 10.91 0 13s.5 4.06 1.39 5.8l3.85-2.99z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.1.74-2.51 1.18-4.2 1.18-3.13 0-5.82-1.98-6.76-4.91L1.39 16.4C3.37 20.33 7.35 23 12 23z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Toggle Sign In / Sign Up */}
        <div className="auth-toggle">
          <span>
            {isSignUp ? "Already have an account?" : "New to Tactical Momentum?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="auth-toggle-link">
              {isSignUp ? "Sign In" : "Register here"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
