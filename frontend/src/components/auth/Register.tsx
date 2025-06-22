import React, { useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

const Register: React.FC = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
    nom: "",
    prenom: "",
    age: "",
    sexe: "",
    telephone: "", // <-- Ajout du champ téléphone
    role: "", // Ajout du champ role
  });
  const [errors, setErrors] = useState({
    nom: "",
    prenom: "",
    age: "",
    sexe: "",
    telephone: "",
    email: "",
    password: "",
    role: "",
  });
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const roleParam = params.get("role");

  React.useEffect(() => {
    if (roleParam === "medecin" || roleParam === "patient") {
      setForm((prev) => ({ ...prev, role: roleParam }));
    }
  }, [roleParam]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    validateField(e.target.name, e.target.value);
  };

  const validateField = (name: string, value: string) => {
    let error = "";
    if (name === "nom" && (!value || !/^[a-zA-ZÀ-ÿ\s'-]+$/.test(value))) {
      error = "Nom invalide (lettres uniquement)";
    }
    if (name === "prenom" && (!value || !/^[a-zA-ZÀ-ÿ\s'-]+$/.test(value))) {
      error = "Prénom invalide (lettres uniquement)";
    }
    if (name === "age" && (!value || isNaN(Number(value)) || Number(value) <= 0)) {
      error = "Âge invalide";
    }
    if (name === "sexe" && !value) {
      error = "Veuillez sélectionner un sexe";
    }
    if (name === "telephone" && (!value || !/^\d{10,15}$/.test(value))) {
      error = "Numéro de téléphone invalide (10 à 15 chiffres)";
    }
    if (name === "email" && !/^[^@]+@[^@]+\.[^@]+$/.test(value)) {
      error = "Adresse email invalide";
    }
    if (name === "password" && value.length < 6) {
      error = "Le mot de passe doit contenir au moins 6 caractères";
    }
    if (name === "role" && !value) {
      error = "Veuillez choisir un rôle";
    }
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation de tous les champs à la soumission
    const newErrors = {
      nom: (!form.nom || !/^[a-zA-ZÀ-ÿ\s'-]+$/.test(form.nom)) ? "Nom invalide (lettres uniquement)" : "",
      prenom: (!form.prenom || !/^[a-zA-ZÀ-ÿ\s'-]+$/.test(form.prenom)) ? "Prénom invalide (lettres uniquement)" : "",
      age: (!form.age || isNaN(Number(form.age)) || Number(form.age) <= 0) ? "Âge invalide" : "",
      sexe: !form.sexe ? "Veuillez sélectionner un sexe" : "",
      telephone: (!form.telephone || !/^\d{10,15}$/.test(form.telephone)) ? "Numéro de téléphone invalide (10 à 15 chiffres)" : "",
      email: !/^[^@]+@[^@]+\.[^@]+$/.test(form.email) ? "Adresse email invalide" : "",
      password: form.password.length < 6 ? "Le mot de passe doit contenir au moins 6 caractères" : "",
      role: !form.role ? "Veuillez choisir un rôle" : "",
    };
    setErrors(newErrors);
    const hasError = Object.values(newErrors).some(e => e);
    if (hasError) return;
    try {
      await axios.post("http://localhost:8000/register", form);
      setSuccessMsg("Compte créé avec succès ! Vous allez être redirigé vers la connexion.");
      setErrorMsg("");
      setTimeout(() => {
        setSuccessMsg("");
        navigate("/login?role=" + form.role);
      }, 2500);
    } catch (error) {
      setErrorMsg("Erreur lors de l'inscription. Veuillez réessayer.");
      setSuccessMsg("");
      setTimeout(() => setErrorMsg("") , 3500);
    }
  };

  return (
    <form
      onSubmit={handleRegister}
      className="w-full max-w-lg md:max-w-md sm:max-w-xs bg-white/90 rounded-3xl shadow-2xl p-8 md:p-10 animate-fade-in flex flex-col items-center relative overflow-hidden"
      style={{ minWidth: 280 }}
    >
      {/* Box message de succès ou d'erreur */}
      {successMsg && (
        <div className="w-full mb-4 p-3 rounded-xl bg-green-100 border border-green-400 text-green-800 text-center font-semibold shadow animate-fade-in-fast">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="w-full mb-4 p-3 rounded-xl bg-red-100 border border-red-400 text-red-800 text-center font-semibold shadow animate-fade-in-fast">
          {errorMsg}
        </div>
      )}
      {/* Animation médicale */}
      <div className="absolute -top-10 -right-10 opacity-30 pointer-events-none z-0">
        <svg width="120" height="120">
          <circle cx="60" cy="60" r="60" fill="#22c55e" />
          <rect x="30" y="50" width="60" height="20" rx="10" fill="#38bdf8" />
        </svg>
      </div>
      <div className="flex items-center gap-2 mb-2 z-10">
        <span className="inline-block w-8 h-8 bg-gradient-to-tr from-green-400 to-blue-400 rounded-full flex items-center justify-center shadow">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
            <rect x="9" y="2" width="6" height="20" rx="3" fill="#22c55e"/>
            <rect x="2" y="9" width="20" height="6" rx="3" fill="#38bdf8"/>
          </svg>
        </span>
        <h2 className="text-2xl font-extrabold text-green-700 tracking-tight drop-shadow">
          Inscription {roleParam && (roleParam === "medecin" ? "Médecin" : "Patient")}
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4 text-center z-10">
        Créez votre compte pour accéder à l'analyse dermatologique intelligente
      </p>
      <div className="flex flex-col gap-4 w-full z-10">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            name="nom"
            placeholder="Nom"
            className="p-3 border-2 border-green-200 rounded-xl w-40"
            value={form.nom}
            onChange={handleChange}
            required
          />
          {errors.nom && <div className="text-red-600 text-sm mt-1">{errors.nom}</div>}
          <input
            type="text"
            name="prenom"
            placeholder="Prénom"
            className="p-3 border-2 border-green-200 rounded-xl w-40"
            value={form.prenom}
            onChange={handleChange}
            required
          />
          {errors.prenom && <div className="text-red-600 text-sm mt-1">{errors.prenom}</div>}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="number"
            name="age"
            placeholder="Âge"
            className="p-3 border-2 border-green-200 rounded-xl flex-1"
            value={form.age}
            onChange={handleChange}
            min={0}
            required
          />
          {errors.age && <div className="text-red-600 text-sm mt-1">{errors.age}</div>}
          <select
            name="sexe"
            className="p-3 border-2 border-green-200 rounded-xl flex-1"
            value={form.sexe}
            onChange={handleChange}
            required
          >
            <option value="">Sexe</option>
            <option value="Homme">Homme</option>
            <option value="Femme">Femme</option>
          </select>
          {errors.sexe && <div className="text-red-600 text-sm mt-1">{errors.sexe}</div>}
        </div>
        {/* Ajout du champ téléphone */}
        <input
          type="tel"
          name="telephone"
          placeholder="Numéro de téléphone"
          className="p-3 border-2 border-green-200 rounded-xl w-full"
          value={form.telephone}
          onChange={handleChange}
          pattern="\d{10,15}"
          required
        />
        {errors.telephone && <div className="text-red-600 text-sm mt-1">{errors.telephone}</div>}
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="p-3 border-2 border-green-200 rounded-xl w-full"
          value={form.email}
          onChange={e => { setForm({ ...form, email: e.target.value }); validateField("email", e.target.value); }}
          required
        />
        {errors.email && <div className="text-red-600 text-sm mt-1">{errors.email}</div>}
        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          className="p-3 border-2 border-green-200 rounded-xl w-full"
          value={form.password}
          onChange={handleChange}
          required
        />
        {errors.password && <div className="text-red-600 text-sm mt-1">{errors.password}</div>}
        <select
          name="role"
          className="p-3 border-2 border-green-200 rounded-xl w-full"
          value={form.role}
          onChange={handleChange}
          required
        >
          <option value="">Rôle</option>
          <option value="patient">Patient</option>
          <option value="medecin">Médecin</option>
        </select>
        {errors.role && <div className="text-red-600 text-sm mt-1">{errors.role}</div>}
      </div>
      <button
        type="submit"
        className="w-full mt-6 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold py-3 rounded-xl hover:from-green-600 hover:to-blue-600 transition-all shadow-lg text-lg tracking-wide animate-bounce-once z-10"
      >
        S'inscrire
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
        `}
      </style>
    </form>
  );
};

export default Register;

