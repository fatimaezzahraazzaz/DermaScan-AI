import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import Patient from "./Patient";
import Medecin from "./Medecin";
import { jwtDecode, type JwtPayload } from "jwt-decode";
import { Shield, Stethoscope, AlertTriangle, CheckCircle2, Clock, Sparkles, Users, Award, Zap, ChevronDown, ChevronUp, ImagePlus } from "lucide-react";

// Déclaration d'interface étendue pour JwtPayload
interface CustomJwtPayload extends JwtPayload {
  role?: 'patient' | 'medecin';
}

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [userRole, setUserRole] = useState<'patient' | 'medecin' | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) setToken(savedToken);
  }, []);

  const handleLoginSuccess = (token: string) => {
    setToken(token);
    localStorage.setItem("token", token);
    const params = new URLSearchParams(location.search);
    // Récupère le rôle et l'email depuis le token JWT (pas depuis l'URL)
    const payload = emailAndRoleFromToken(token);
    setUserRole(payload.role);
    setUserEmail(payload.email);
    if (payload.role === "medecin") navigate("/medecin");
    else navigate("/patient");
  };

  // Helper pour extraire l'email et le rôle du token JWT
  function emailAndRoleFromToken(token: string): { email: string | null, role: "patient" | "medecin" | null } {
    try {
      const decoded = jwtDecode(token) as CustomJwtPayload; // Caster en CustomJwtPayload
      return {
        email: decoded.sub || null,
        role: decoded.role === "medecin" ? "medecin" : decoded.role === "patient" ? "patient" : null
      };
    } catch {
      return { email: null, role: null };
    }
  }

  const logout = () => {
    setToken(null);
    localStorage.removeItem("token");
    setUserRole(null);
    navigate("/");
  };

  const isTokenValid = (token: string) => {
    try {
      const decoded = jwtDecode(token);
      return decoded && decoded.exp ? decoded.exp * 1000 > Date.now() : false;
    } catch {
      return false;
    }
  };

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!token || !isTokenValid(token)) {
      return <Navigate to="/login" />;
    }
    return <>{children}</>;
  };

  // Place la déclaration de faqItems avant LoggedOutLayout
  const faqItems = [
    {
      question: "Comment fonctionne l'analyse de peau ?",
      answer: "Notre système utilise l'intelligence artificielle pour analyser les images de votre peau. Il compare les caractéristiques avec une base de données de maladies cutanées pour fournir une analyse précise et rapide."
    },
    {
      question: "Les résultats sont-ils fiables ?",
      answer: "Notre système a été entraîné sur des milliers d'images validées par des dermatologues. Bien que les résultats soient très précis, ils doivent toujours être confirmés par un professionnel de santé."
    },
    {
      question: "Comment mes données sont-elles protégées ?",
      answer: "Toutes vos données sont cryptées et stockées de manière sécurisée. Nous respectons les normes de confidentialité médicale et ne partageons jamais vos informations sans votre consentement."
    }
  ];

  // Composant pour le contenu de la page d'accueil non connecté
  const LoggedOutLayout: React.FC = () => {
    const [faqOpen, setFaqOpen] = React.useState(faqItems.map(() => false));
    return (
      <div className="min-h-screen w-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center">
        {/* Bandeau d'accroche */}
        <div className="w-full bg-gradient-to-r from-green-200 via-blue-100 to-blue-200 py-4 px-6 flex items-center justify-center shadow-md mb-4">
          <span className="text-lg md:text-xl font-semibold text-blue-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-green-500" />
            Bienvenue sur DermaScan AI&nbsp;: l'innovation au service de votre santé cutanée
          </span>
        </div>
        {/* Hero Section */}
        <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-blue-900 mb-4 animate-fade-in">
              DermaScan AI
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto animate-fade-in-delay">
              Votre assistant intelligent pour la détection précoce des maladies de peau
            </p>
          </div>

          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 shadow-lg transform hover:-translate-y-2 transition-all duration-300">
              <div className="bg-blue-500 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-blue-900 mb-2">Analyse Instantanée</h3>
              <p className="text-blue-700">
                Obtenez des résultats en quelques secondes grâce à notre technologie d'IA avancée
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 shadow-lg transform hover:-translate-y-2 transition-all duration-300">
              <div className="bg-green-500 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-green-900 mb-2">Sécurité Maximale</h3>
              <p className="text-green-700">
                Vos données sont protégées avec les plus hauts standards de sécurité médicale
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 shadow-lg transform hover:-translate-y-2 transition-all duration-300">
              <div className="bg-purple-500 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-purple-900 mb-2">Accompagnement Médical</h3>
              <p className="text-purple-700">
                Conseils personnalisés et recommandations de professionnels de santé à proximité
              </p>
            </div>
          </div>

          {/* Main Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow transform hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <Stethoscope className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800">Pour les Patients</h2>
              </div>
              <p className="text-gray-600 mb-4">
                Analysez instantanément vos problèmes de peau et recevez des conseils médicaux personnalisés.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Détection rapide et précise</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span>Suivi de l'évolution</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <Shield className="w-5 h-5 text-purple-500" />
                  <span>Conseils personnalisés</span>
                </li>
              </ul>
              <a
                href="/login"
                className="block w-full text-center bg-blue-600 text-white py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Se connecter
              </a>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow transform hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-green-100 p-3 rounded-xl">
                  <Sparkles className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800">Pour les Médecins</h2>
              </div>
              <p className="text-gray-600 mb-4">
                Accédez à des outils avancés d'analyse et de suivi pour vos patients.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Analyse approfondie</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span>Historique des patients</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <span>Détection précoce</span>
                </li>
              </ul>
              <a
                href="/login"
                className="block w-full text-center bg-green-600 text-white py-2 rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                Se connecter
              </a>
            </div>
          </div>

          {/* Section Processus d'utilisation */}
          <div className="w-full max-w-4xl mx-auto mb-14">
            <h2 className="text-3xl font-bold text-center text-blue-700 mb-8">Comment ça marche&nbsp;?</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center bg-blue-50 rounded-2xl p-6 shadow hover:shadow-lg transition">
                <Users className="w-12 h-12 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold text-blue-800 mb-2">1. Créez un compte</h3>
                <p className="text-gray-600 text-center">Inscrivez-vous gratuitement en tant que patient ou médecin pour accéder à toutes les fonctionnalités.</p>
              </div>
              <div className="flex flex-col items-center bg-green-50 rounded-2xl p-6 shadow hover:shadow-lg transition">
                <ImagePlus className="w-12 h-12 text-green-400 mb-3" />
                <h3 className="text-lg font-semibold text-green-800 mb-2">2. Importez une photo</h3>
                <p className="text-gray-600 text-center">Téléchargez une photo de la zone de peau à analyser, en toute sécurité et confidentialité.</p>
              </div>
              <div className="flex flex-col items-center bg-yellow-50 rounded-2xl p-6 shadow hover:shadow-lg transition">
                <Award className="w-12 h-12 text-yellow-400 mb-3" />
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">3. Recevez l'analyse</h3>
                <p className="text-gray-600 text-center">Obtenez un diagnostic assisté par IA, des conseils personnalisés et trouvez un professionnel à proximité.</p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-5xl mx-auto mb-16">
            <h2 className="text-4xl font-extrabold text-center text-blue-800 mb-10 drop-shadow">Vous vous posez des questions&nbsp;?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {faqItems.map((item: any, index: number) => {
                const themes = [
                  { bg: 'bg-gradient-to-br from-blue-100 to-blue-50', icon: <Sparkles className="w-8 h-8 text-blue-400" /> },
                  { bg: 'bg-gradient-to-br from-green-100 to-green-50', icon: <Shield className="w-8 h-8 text-green-400" /> },
                  { bg: 'bg-gradient-to-br from-yellow-100 to-yellow-50', icon: <CheckCircle2 className="w-8 h-8 text-yellow-400" /> },
                  { bg: 'bg-gradient-to-br from-purple-100 to-purple-50', icon: <AlertTriangle className="w-8 h-8 text-purple-400" /> },
                ];
                const theme = themes[index % themes.length];
                const open = faqOpen[index];
                return (
                  <div
                    key={index}
                    className={`${theme.bg} rounded-3xl shadow-xl p-7 flex flex-col items-center transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl relative group`}
                    style={{ minHeight: 220 }}
                  >
                    <button
                      className="flex flex-col items-center w-full focus:outline-none"
                      onClick={() => setFaqOpen(faqOpen.map((v, i) => i === index ? !v : v))}
                      aria-expanded={open}
                      type="button"
                    >
                      <div className="mb-3">{theme.icon}</div>
                      <span className="text-lg font-bold text-blue-900 text-center mb-2 group-hover:text-blue-700 transition-colors">
                        {item.question}
                      </span>
                      <span className={`mt-2 text-base text-gray-700 text-center transition-all duration-500 ${open ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}
                            style={{ minHeight: open ? 60 : 0 }}>
                        {item.answer}
                      </span>
                      <span className="mt-3 text-xs text-blue-400 group-hover:text-blue-600 transition-colors">{open ? '▲' : '▼'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center text-gray-500 mt-auto">
            <p>Une solution innovante pour la santé de votre peau</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          token && isTokenValid(token) ? (
            <Navigate to="/patient" />
          ) : (
            <LoggedOutLayout />
          )
        }
      />
      <Route
        path="/login"
        element={
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <LoggedOutLayout />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center" onClick={() => navigate("/")}>
              <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center space-y-4 min-w-[340px] z-50" onClick={(e) => e.stopPropagation()}>
                <div className="flex w-full mb-4">
                  <button
                    className="flex-1 py-2 rounded-l-xl font-semibold transition bg-blue-500 text-white"
                    disabled
                  >
                    Connexion
                  </button>
                  <button
                    className="flex-1 py-2 rounded-r-xl font-semibold transition bg-green-100 text-green-700"
                    onClick={() => navigate("/register" + location.search)}
                  >
                    Inscription
                  </button>
                </div>
                <Login onLoginSuccess={handleLoginSuccess} />
              </div>
            </div>
          </div>
        }
      />
      <Route
        path="/register"
        element={
          <div className="fixed inset-0 z-50 flex items-center justify-center">
             <LoggedOutLayout />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center" onClick={() => navigate("/")}>
              <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center space-y-4 min-w-[340px] z-50" onClick={(e) => e.stopPropagation()}>
                <div className="flex w-full mb-4">
                  <button
                    className="flex-1 py-2 rounded-l-xl font-semibold transition bg-blue-100 text-blue-700"
                    onClick={() => navigate("/login" + location.search)}
                  >
                    Connexion
                  </button>
                  <button
                    className="flex-1 py-2 rounded-r-xl font-semibold transition bg-green-500 text-white"
                    disabled
                  >
                    Inscription
                  </button>
                </div>
                <Register />
              </div>
            </div>
          </div>
        }
      />
      <Route
        path="/patient"
        element={
          <ProtectedRoute>
            <div className="min-h-screen w-screen bg-gradient-to-b from-blue-100 via-white to-green-50 flex flex-col items-center justify-center relative">
              <div className="absolute top-4 right-4">
                <LogoutButton />
              </div>
              <div className="absolute top-4 left-4 bg-blue-100 text-blue-700 px-4 py-2 rounded shadow">
                {userEmail && <>Connecté avec : <b>{userEmail}</b></>}
              </div>
              <div className="w-full flex items-center justify-center">
                <Patient token={token!} />
              </div>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/medecin"
        element={
          <ProtectedRoute>
            <div className="min-h-screen w-screen bg-gradient-to-b from-blue-100 via-white to-green-50 flex flex-col items-center justify-center relative">
              <div className="absolute top-4 right-4">
                <LogoutButton />
              </div>
              <div className="absolute top-4 left-4 bg-green-100 text-green-700 px-4 py-2 rounded shadow">
                {userEmail && <>Connecté avec : <b>{userEmail}</b></>}
              </div>
              <div className="w-full flex items-center justify-center">
                <Medecin token={token!} />
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Supprimer le token ou les infos de session
    localStorage.removeItem("token");
    // Rediriger vers App.tsx (par exemple la page d'accueil ou de login)
    navigate("/");
  };

  return <button onClick={handleLogout}>Déconnexion</button>;
};

export default App;
