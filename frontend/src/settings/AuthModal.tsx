import React, { useState } from "react";
import { Cpu, LogIn, UserPlus } from "lucide-react";
import { apiRequest, setStoredToken } from "../api";

interface Props {
  isOpen: boolean;
  initialMode: "login" | "signup";
  canDismiss: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export const AuthModal: React.FC<Props> = ({
  isOpen,
  initialMode,
  canDismiss,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [institution, setInstitution] = useState<string>("Omniscient AI University");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  React.useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? { full_name: fullName, email, password, institution }
          : { email, password };
      const res = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
      setStoredToken(res.access_token);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#000000]/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#D4AF37] bg-[#0A0A0A] p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#D4AF37]/25 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#000000] border border-[#D4AF37] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#FFFFFF]">OMNISCIENT AI</h2>
              <p className="text-xs text-[#BDBDBD]">
                {mode === "login" ? "Sign in to your account" : "Create a new account"}
              </p>
            </div>
          </div>
          {canDismiss && (
            <button onClick={onClose} className="text-xs text-[#777777] hover:text-[#FFFFFF]">
              ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={mode === "login" ? "btn-primary" : "btn-secondary"}
          >
            <LogIn className="w-3.5 h-3.5" />
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={mode === "signup" ? "btn-primary" : "btn-secondary"}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Sign Up
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[#000000] border border-[#B22222] text-xs text-[#B22222]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name..."
                className="input-field w-full"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="input-field w-full"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                Institution / Organization
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="input-field w-full"
              />
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading
              ? "Processing..."
              : mode === "login"
              ? "Log In to Omniscient AI"
              : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
};
