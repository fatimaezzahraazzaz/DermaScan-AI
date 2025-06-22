import React, { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

interface Props {
  onLoginSuccess: (token: string) => void;
}

const Login: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const roleParam = params.get("role");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post("http://localhost:8000/login?role=" + roleParam, { email, password });
      // Si le backend retourne un champ "redirect", on redirige et affiche le message
      if (res.data.redirect && res.data.message) {
        setError(res.data.message);
        setTimeout(() => {
          navigate(res.data.redirect);
        }, 1800);
        return;
      }
      if (roleParam && res.data.role && res.data.role !== roleParam) {
        setError("Vous essayez de vous connecter en tant que " + roleParam + " mais ce compte est de type " + res.data.role + ".");
        return;
      }
      onLoginSuccess(res.data.access_token);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erreur lors de la connexion");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md bg-white/90 rounded-3xl shadow-2xl p-10 animate-fade-in flex flex-col items-center relative overflow-hidden"
    >
      {/* Animation médicale */}
      <div className="absolute -top-10 -right-10 opacity-30 pointer-events-none z-0">
        <svg width="120" height="120">
          <circle cx="60" cy="60" r="60" fill="#38bdf8" />
          <rect x="30" y="50" width="60" height="20" rx="10" fill="#22c55e" />
        </svg>
      </div>
      <div className="flex items-center gap-2 mb-2 z-10">
        <span className="inline-block w-8 h-8 bg-gradient-to-tr from-blue-400 to-green-400 rounded-full flex items-center justify-center shadow">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
            <rect x="9" y="2" width="6" height="20" rx="3" fill="#38bdf8" />
            <rect x="2" y="9" width="20" height="6" rx="3" fill="#22c55e" />
          </svg>
        </span>
        <h2 className="text-2xl font-extrabold text-blue-700 tracking-tight drop-shadow">
          Connexion
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4 text-center z-10">
        Accédez à votre espace de diagnostic dermatologique
      </p>
      {error && (
        <div className="w-full mb-3 z-10">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative animate-shake text-center font-semibold shadow">
            {error}
          </div>
        </div>
      )}
      <input
        type="email"
        placeholder="Email"
        className="w-full p-3 mb-4 border-2 border-blue-200 rounded-xl focus:outline-none focus:border-blue-500 transition z-10"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        autoFocus
      />
      <input
        type="password"
        placeholder="Mot de passe"
        className="w-full p-3 mb-6 border-2 border-blue-200 rounded-xl focus:outline-none focus:border-blue-500 transition z-10"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-green-500 text-white font-bold py-3 rounded-xl hover:from-blue-600 hover:to-green-600 transition-all shadow-lg text-lg tracking-wide animate-bounce-once z-10"
      >
        Se connecter
      </button>
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(30px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .animate-fade-in { animation: fade-in 0.8s cubic-bezier(.4,2,.6,1); }
          @keyframes bounce-once {
            0% { transform: scale(1);}
            30% { transform: scale(1.08);}
            60% { transform: scale(0.97);}
            100% { transform: scale(1);}
          }
          .animate-bounce-once { animation: bounce-once 0.7s 1; }
          @keyframes shake {
            0% { transform: translateX(0);}
            20% { transform: translateX(-8px);}
            40% { transform: translateX(8px);}
            60% { transform: translateX(-8px);}
            80% { transform: translateX(8px);}
            100% { transform: translateX(0);}
          }
          .animate-shake { animation: shake 0.4s; }
        `}
      </style>
    </form>
  );
};

export default Login;
