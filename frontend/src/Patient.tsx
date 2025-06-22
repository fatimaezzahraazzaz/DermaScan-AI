import React, { useState } from "react";
import { Loader2, ImagePlus, History, Info, LogOut, User, Download, Menu, X, ArrowLeft, Trash2 } from "lucide-react";
import jsPDF from "jspdf";

// Déclaration des types pour Google Maps
declare global {
  interface Window {
    google: {
      maps: {
        Map: any;
        Marker: any;
        PlacesService: any;
        InfoWindow: any;
        places: {
          PlacesService: any;
        };
      };
    };
  }
}

interface PatientProps {
  token: string;
}

const Patient: React.FC<PatientProps> = ({ token }) => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!image) return alert("Veuillez sélectionner une image.");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", image);

    try {
      const res = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Erreur serveur");
      }

      const data = await res.json();
      setResult(data);
    } catch (error) {
      alert("Erreur serveur : " + error);
    }

    setLoading(false);
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    setShowHistory(true);
    try {
      // Récupère l'email depuis le token JWT
      const payload = JSON.parse(atob(token.split(".")[1]));
      const email = payload.sub;
      const res = await fetch(`http://localhost:8000/history/${email}`);
      const data = await res.json();
      setHistory(data);
    } catch {
      setHistory([]);
    }
    setLoadingHistory(false);
  };

  // Ajoute une fonction de déconnexion 
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  // Ajoute une fonction pour afficher le profil 
  const handleProfile = () => {
    setProfileOpen(true);
  };

  // Ajoute une fonction pour télécharger le rapport 
  const handleDownload = async () => {
    if (!result?.prediction_id) {
      alert("Veuillez d'abord effectuer une analyse.");
      return;
    }
    try {
      // Récupère l'email depuis le token JWT
      const payload = JSON.parse(atob(token.split(".")[1]));
      const email = payload.sub;

      // Récupère les infos de la prédiction et du profil
      const [historyRes, userRes] = await Promise.all([
        fetch(`http://localhost:8000/history_full/${email}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch("http://localhost:8000/users", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const history = await historyRes.json();
      const users = await userRes.json();
      const userInfo = users.find((u: any) => u.email === email);
      const prediction = history.find((h: any) => h.id === result.prediction_id);

      if (!prediction) {
        alert("Impossible de générer le rapport.");
        return;
      }

      // Récupère les JSON nécessaires pour conseils et liens
      const [adviceJson, linksJson] = await Promise.all([
        fetch("/disease_advice.json").then(r => r.json()).catch(() => ({})),
        fetch("/disease_links.json").then(r => r.json()).catch(() => ({}))
      ]);

      // --- PDF PRO ---
      const doc = new jsPDF();
      let y = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 18;
      const sectionSpace = 12;

      // Logo DermaScan AI
      doc.setFillColor(34, 197, 94); // vert
      doc.rect(margin, y - 12, 10, 10, 'F');
      doc.setFillColor(59, 130, 246); // bleu
      doc.rect(margin + 12, y - 12, 10, 10, 'F');
      doc.setFontSize(22);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("DermaScan AI - Rapport d'analyse", pageWidth / 2, y, { align: "center" });
      y += 10;
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(1.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      // --- Infos patient détaillées ---
      doc.setFontSize(15);
      doc.setTextColor(59, 130, 246);
      doc.setFont('helvetica', 'bold');
      doc.text("Informations du patient", margin, y);
      y += 7;
      doc.setDrawColor(200, 230, 201);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      doc.text(`Nom : ${userInfo?.prenom || ""} ${userInfo?.nom || ""}`, margin, y); y += 6;
      doc.text(`Email : ${userInfo?.email || ""}`, margin, y); y += 6;
      doc.text(`Téléphone : ${userInfo?.telephone || ""}`, margin, y); y += 6;
      doc.text(`Sexe : ${userInfo?.sexe || ""}`, margin, y); y += 6;
      doc.text(`Âge : ${userInfo?.age || ""}`, margin, y); y += sectionSpace;

      // --- Image analysée ---
      doc.setFontSize(15);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("Image analysée", margin, y);
      y += 7;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      // Ajoute l'image si disponible
      if (prediction.image_data) {
        try {
          const img = new Image();
          img.src = `data:image/jpeg;base64,${prediction.image_data}`;
          await new Promise((resolve) => {
            img.onload = resolve;
          });

          const maxWidth = pageWidth - 2 * margin;
          const maxHeight = 60;
          let imgWidth = img.width;
          let imgHeight = img.height;

          if (imgWidth > maxWidth) {
            const ratio = maxWidth / imgWidth;
            imgWidth = maxWidth;
            imgHeight = imgHeight * ratio;
          }
          if (imgHeight > maxHeight) {
            const ratio = maxHeight / imgHeight;
            imgHeight = maxHeight;
            imgWidth = imgWidth * ratio;
          }

          const x = (pageWidth - imgWidth) / 2;
          doc.addImage(img, 'JPEG', x, y, imgWidth, imgHeight);
          y += imgHeight + 2;

          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.text("Image analysée par DermaScan AI", pageWidth / 2, y, { align: "center" });
          y += 3;
          y += 2;
        } catch (error) {
          console.error("Erreur lors de l'ajout de l'image au PDF:", error);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          doc.setTextColor(33, 37, 41);
          doc.text("Image non disponible", margin, y);
          y += sectionSpace;
        }
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(33, 37, 41);
        doc.text("Image non disponible", margin, y);
        y += sectionSpace;
      }

      // --- Résultat principal ---
      doc.setFontSize(15);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("Résultat de l'analyse", margin, y);
      y += 7;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      const dateStr = prediction.date ? new Date(prediction.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      doc.text(`Date de l'analyse : ${dateStr}`, margin, y); y += 6;
      doc.text(`Maladie prédite : ${prediction.predicted_class}`, margin, y); y += 6;
      let confVal = '';
      if (typeof prediction.confidence === 'number') {
        confVal = (prediction.confidence <= 1 ? (prediction.confidence * 100).toFixed(1) : prediction.confidence.toFixed(1)) + '%';
      } else if (typeof prediction.confidence === 'string') {
        const numConf = parseFloat(prediction.confidence);
        if (!isNaN(numConf)) {
          confVal = (numConf <= 1 ? (numConf * 100).toFixed(1) : numConf.toFixed(1)) + '%';
        } else {
          confVal = prediction.confidence;
        }
      }
      doc.text(`Confiance : ${confVal}`, margin, y); y += sectionSpace;

      // --- Conseils médicaux ---
      doc.setFontSize(15);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("Conseils médicaux", margin, y);
      y += 7;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);

      // Recherche des conseils dans le JSON
      const adviceKey = Object.keys(adviceJson).find(k => prediction.predicted_class.includes(k));
      if (adviceKey && adviceJson[adviceKey]) {
        const advice = adviceJson[adviceKey];
        if (advice.description) {
          doc.text("Description :", margin, y); y += 6;
          const descLines = doc.splitTextToSize(advice.description, pageWidth - 2 * margin);
          doc.text(descLines, margin, y); y += descLines.length * 6;
        }
        if (Array.isArray(advice.conseils)) {
          doc.text("Conseils :", margin, y); y += 6;
          advice.conseils.forEach((conseil: string) => {
            const lines = doc.splitTextToSize(`• ${conseil}`, pageWidth - 2 * margin);
            doc.text(lines, margin, y); y += lines.length * 6;
          });
        }
        if (advice.gravite) {
          doc.text(`Gravité : ${advice.gravite}`, margin, y); y += 6;
        }
        if (advice.recommandation) {
          doc.text("Recommandation :", margin, y); y += 6;
          const recLines = doc.splitTextToSize(advice.recommandation, pageWidth - 2 * margin);
          doc.text(recLines, margin, y); y += recLines.length * 6;
        }
      } else {
        doc.text("Aucun conseil spécifique disponible pour cette maladie.", margin, y); y += 6;
      }
      y += sectionSpace;

      // --- Liens utiles ---
      // Recherche des liens dans le JSON
      const linksKey = Object.keys(linksJson).find(k => prediction.predicted_class.includes(k));
      const diseaseLinks = linksKey ? linksJson[linksKey] : null;

      if (diseaseLinks && Array.isArray(diseaseLinks) && diseaseLinks.length > 0) {
        // Vérifie si on a besoin d'une nouvelle page
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(15);
        doc.setTextColor(34, 197, 94);
        doc.setFont('helvetica', 'bold');
        doc.text("Liens utiles", margin, y);
        y += 7;
        doc.setDrawColor(191, 219, 254);
        doc.setLineWidth(0.7);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(33, 37, 41);

        diseaseLinks.forEach((link: any) => {
          // Vérifie si on a besoin d'une nouvelle page
          if (y > 250) {
            doc.addPage();
            y = 20;
          }

          // Titre du lien
          const titleLines = doc.splitTextToSize(`• ${link.title}`, pageWidth - 2 * margin);
          doc.text(titleLines, margin, y);
          y += titleLines.length * 6;

          // URL du lien (cliquable)
          doc.setFontSize(10);
          doc.setTextColor(59, 130, 246); // Bleu pour indiquer que c'est un lien
          const urlLines = doc.splitTextToSize(`  ${link.url}`, pageWidth - 2 * margin);
          doc.text(urlLines, margin, y);
          // Ajoute le lien cliquable
          doc.link(margin, y - urlLines.length * 5, pageWidth - 2 * margin, urlLines.length * 5, { url: link.url });
          y += urlLines.length * 5;

          // Réinitialise la taille et la couleur
          doc.setFontSize(12);
          doc.setTextColor(33, 37, 41);
          y += 4; // Espace entre les liens
        });
      }

      // --- Médecins recommandés ---
      // Vérifie si on a besoin d'une nouvelle page
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(15);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("Médecins recommandés", margin, y);
      y += 7;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);

      // Récupère les médecins depuis l'API Google Places
      try {
        // Fonction pour déterminer la spécialité en fonction de la maladie
        const getSpecialty = (disease: string) => {
          if (!disease) return "dermatologue";
          const d = disease.toLowerCase();
          if (
            d.includes("acne") ||
            d.includes("eczema") ||
            d.includes("psoriasis") ||
            d.includes("melanoma") ||
            d.includes("dermatitis") ||
            d.includes("keratosis") ||
            d.includes("tinea") ||
            d.includes("warts") ||
            d.includes("seborrheic")
          ) {
            return "dermatologue";
          }
          return "médecin";
        };

        const specialty = getSpecialty(prediction.predicted_class);
        const service = new window.google.maps.places.PlacesService(document.createElement("div"));
        const userPos = await new Promise<{lat: number, lng: number}>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(new Error("Impossible de récupérer la position de l'utilisateur."))
          );
        });

        let doctors = [];
        try {
          doctors = await new Promise<any[]>((resolve) => {
            service.nearbySearch(
              {
                location: userPos,
                radius: 5000,
                keyword: specialty,
                type: "doctor"
              },
              (results: any, status: any) => {
                if (status === "OK" && Array.isArray(results)) {
                  resolve(results.slice(0, 3));
                } else {
                  resolve([]);
                }
              }
            );
          });
        } catch (error) {
          doc.text("Impossible de récupérer la liste des médecins (géolocalisation refusée ou indisponible).", margin, y);
          y += 6;
        }

        if (doctors.length > 0) {
          doctors.forEach((doctor, index) => {
            // Vérifie si on a besoin d'une nouvelle page
            if (y > 250) {
              doc.addPage();
              y = 20;
            }

            // Nom du médecin
            doc.setFont('helvetica', 'bold');
            const nameLines = doc.splitTextToSize(`${index + 1}. ${doctor.name}`, pageWidth - 2 * margin);
            doc.text(nameLines, margin, y);
            y += nameLines.length * 6;

            // Adresse
            doc.setFont('helvetica', 'normal');
            const addressLines = doc.splitTextToSize(`   Adresse : ${doctor.vicinity}`, pageWidth - 2 * margin);
            doc.text(addressLines, margin, y);
            y += addressLines.length * 6;

            y += 4; // Espace entre les médecins
          });
        } else {
          doc.text("Aucun médecin trouvé à proximité.", margin, y);
          y += 6;
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des médecins:", error);
        doc.text("Impossible de récupérer la liste des médecins.", margin, y);
        y += 6;
      }

      y += 10;
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(11);
      doc.text("Merci d'utiliser DermaScan AI.", margin, y);

      // Pied de page
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text("Rapport généré automatiquement - DermaScan AI", pageWidth / 2, 290, { align: "center" });

      // Sauvegarde du PDF
      const fileName = `rapport_${userInfo?.nom || "patient"}_${prediction.id}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      alert("Erreur lors de la génération du rapport PDF.");
    }
  };

  // Suppression d'une prédiction de l'historique
  const handleDeleteHistory = async (id: number) => {
    setPendingDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteHistory = async () => {
    if (!pendingDeleteId) return;
    try {
      await fetch(`http://localhost:8000/delete_prediction/${pendingDeleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory((prev) => prev.filter((h) => h.id !== pendingDeleteId));
      if (selectedHistory && selectedHistory.id === pendingDeleteId) setSelectedHistory(null);
    } catch {
      alert("Erreur lors de la suppression.");
    }
    setShowDeleteModal(false);
    setPendingDeleteId(null);
  };

  // Ajoute cette nouvelle fonction pour gérer le téléchargement du rapport historique
  const handleDownloadHistory = async (historyItem: any) => {
    try {
      // Fonction pour déterminer la spécialité en fonction de la maladie
      const getSpecialty = (disease: string) => {
        if (!disease) return "dermatologue";
        const d = disease.toLowerCase();
        if (
          d.includes("acne") ||
          d.includes("eczema") ||
          d.includes("psoriasis") ||
          d.includes("melanoma") ||
          d.includes("dermatitis") ||
          d.includes("keratosis") ||
          d.includes("tinea") ||
          d.includes("warts") ||
          d.includes("seborrheic")
        ) {
          return "dermatologue";
        }
        return "médecin";
      };

      // Récupérer les informations de l'utilisateur
      const userResponse = await fetch("http://localhost:8000/user", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const userData = await userResponse.json();

      // Récupérer l'image de la prédiction
      let imageData: string | null = null;
      try {
        const imageResponse = await fetch(`http://localhost:8000/prediction/${historyItem.id}/image`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (imageResponse.ok) {
          const blob = await imageResponse.blob();
          imageData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch (error) {
        console.error("Erreur lors de la récupération de l'image:", error);
      }

      // Récupérer les conseils médicaux
      const adviceResponse = await fetch("http://localhost:8000/disease_advice", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const adviceData = await adviceResponse.json();

      // Récupérer les liens utiles
      const linksResponse = await fetch("http://localhost:8000/disease_links", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const linksData = await linksResponse.json();

      // Créer le PDF
      const doc = new jsPDF();
      let y = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 18;
      const sectionSpace = 12;

      // Logo DermaScan AI
      doc.setFillColor(34, 197, 94); // vert
      doc.rect(margin, y - 12, 10, 10, 'F');
      doc.setFillColor(59, 130, 246); // bleu
      doc.rect(margin + 12, y - 12, 10, 10, 'F');
      doc.setFontSize(22);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("DermaScan AI - Rapport d'analyse", pageWidth / 2, y, { align: "center" });
      y += 10;
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(1.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      // --- Infos patient détaillées ---
      doc.setFontSize(15);
      doc.setTextColor(59, 130, 246);
      doc.setFont('helvetica', 'bold');
      doc.text("Informations du patient", margin, y);
      y += 7;
      doc.setDrawColor(200, 230, 201);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      doc.text(`Nom : ${userData.prenom} ${userData.nom}`, margin, y); y += 6;
      doc.text(`Email : ${userData.email}`, margin, y); y += 6;
      doc.text(`Téléphone : ${userData.telephone}`, margin, y); y += 6;
      doc.text(`Sexe : ${userData.sexe}`, margin, y); y += 6;
      doc.text(`Âge : ${userData.age}`, margin, y); y += sectionSpace;

      // --- Image analysée ---
      doc.setFontSize(15);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("Image analysée", margin, y);
      y += 7;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      // Ajoute l'image si disponible
      if (imageData) {
        try {
          const img = new Image();
          img.src = imageData;
          await new Promise((resolve) => {
            img.onload = resolve;
          });

          const maxWidth = pageWidth - 2 * margin;
          const maxHeight = 60;
          let imgWidth = img.width;
          let imgHeight = img.height;

          if (imgWidth > maxWidth) {
            const ratio = maxWidth / imgWidth;
            imgWidth = maxWidth;
            imgHeight = imgHeight * ratio;
          }
          if (imgHeight > maxHeight) {
            const ratio = maxHeight / imgHeight;
            imgHeight = maxHeight;
            imgWidth = imgWidth * ratio;
          }

          const x = (pageWidth - imgWidth) / 2;
          doc.addImage(img, 'JPEG', x, y, imgWidth, imgHeight);
          y += imgHeight + 2;

          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.text("Image analysée par DermaScan AI", pageWidth / 2, y, { align: "center" });
          y += 3;
          y += 2;
        } catch (error) {
          console.error("Erreur lors de l'ajout de l'image au PDF:", error);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          doc.setTextColor(33, 37, 41);
          doc.text("Image non disponible", margin, y);
          y += sectionSpace;
        }
      }

      // --- Résultat principal ---
      doc.setFontSize(15);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("Résultat de l'analyse", margin, y);
      y += 7;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      const dateStr = historyItem.date ? new Date(historyItem.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      doc.text(`Date de l'analyse : ${dateStr}`, margin, y); y += 6;
      doc.text(`Maladie prédite : ${historyItem.predicted_class}`, margin, y); y += 6;
      if (historyItem.confidence) {
        let confVal = '';
        if (typeof historyItem.confidence === 'number') {
          confVal = (historyItem.confidence <= 1 ? (historyItem.confidence * 100).toFixed(1) : historyItem.confidence.toFixed(1)) + '%';
        } else if (typeof historyItem.confidence === 'string') {
          const numConf = parseFloat(historyItem.confidence);
          if (!isNaN(numConf)) {
            confVal = (numConf <= 1 ? (numConf * 100).toFixed(1) : numConf.toFixed(1)) + '%';
          } else {
            confVal = historyItem.confidence;
          }
        }
        doc.text(`Confiance : ${confVal}`, margin, y); y += sectionSpace;
      }

      // --- Conseils médicaux ---
      doc.setFontSize(15);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("Conseils médicaux", margin, y);
      y += 7;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);

      // Recherche des conseils dans le JSON
      const adviceKey = Object.keys(adviceData).find(k => historyItem.predicted_class.includes(k));
      if (adviceKey && adviceData[adviceKey]) {
        const advice = adviceData[adviceKey];
        if (advice.description) {
          doc.text("Description :", margin, y); y += 6;
          const descLines = doc.splitTextToSize(advice.description, pageWidth - 2 * margin);
          doc.text(descLines, margin, y); y += descLines.length * 6;
        }
        if (Array.isArray(advice.conseils)) {
          doc.text("Conseils :", margin, y); y += 6;
          advice.conseils.forEach((conseil: string) => {
            const lines = doc.splitTextToSize(`• ${conseil}`, pageWidth - 2 * margin);
            doc.text(lines, margin, y); y += lines.length * 6;
          });
        }
        if (advice.gravite) {
          doc.text(`Gravité : ${advice.gravite}`, margin, y); y += 6;
        }
        if (advice.recommandation) {
          doc.text("Recommandation :", margin, y); y += 6;
          const recLines = doc.splitTextToSize(advice.recommandation, pageWidth - 2 * margin);
          doc.text(recLines, margin, y); y += recLines.length * 6;
        }
      } else {
        doc.text("Aucun conseil spécifique disponible pour cette maladie.", margin, y); y += 6;
      }
      y += sectionSpace;

      // --- Liens utiles ---
      const linksKey = Object.keys(linksData).find(k => historyItem.predicted_class.includes(k));
      const diseaseLinks = linksKey ? linksData[linksKey] : null;

      if (diseaseLinks && Array.isArray(diseaseLinks) && diseaseLinks.length > 0) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(15);
        doc.setTextColor(34, 197, 94);
        doc.setFont('helvetica', 'bold');
        doc.text("Liens utiles", margin, y);
        y += 7;
        doc.setDrawColor(191, 219, 254);
        doc.setLineWidth(0.7);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(33, 37, 41);

        diseaseLinks.forEach((link: any) => {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }

          const titleLines = doc.splitTextToSize(`• ${link.title}`, pageWidth - 2 * margin);
          doc.text(titleLines, margin, y);
          y += titleLines.length * 6;

          doc.setFontSize(10);
          doc.setTextColor(59, 130, 246);
          const urlLines = doc.splitTextToSize(`  ${link.url}`, pageWidth - 2 * margin);
          doc.text(urlLines, margin, y);
          doc.link(margin, y - urlLines.length * 5, pageWidth - 2 * margin, urlLines.length * 5, { url: link.url });
          y += urlLines.length * 5;

          doc.setFontSize(12);
          doc.setTextColor(33, 37, 41);
          y += 4;
        });
      }

      // --- Médecins recommandés ---
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(15);
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.text("Médecins recommandés", margin, y);
      y += 7;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.7);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);

      try {
        const specialty = getSpecialty(historyItem.predicted_class);
        const service = new window.google.maps.places.PlacesService(document.createElement("div"));
        const userPos = await new Promise<{lat: number, lng: number}>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(new Error("Impossible de récupérer la position de l'utilisateur."))
          );
        });

        let doctors = [];
        try {
          doctors = await new Promise<any[]>((resolve) => {
            service.nearbySearch(
              {
                location: userPos,
                radius: 5000,
                keyword: specialty,
                type: "doctor"
              },
              (results: any, status: any) => {
                if (status === "OK" && Array.isArray(results)) {
                  resolve(results.slice(0, 3));
                } else {
                  resolve([]);
                }
              }
            );
          });
        } catch (error) {
          doc.text("Impossible de récupérer la liste des médecins (géolocalisation refusée ou indisponible).", margin, y);
          y += 6;
        }

        if (doctors.length > 0) {
          doctors.forEach((doctor, index) => {
            if (y > 250) {
              doc.addPage();
              y = 20;
            }

            doc.setFont('helvetica', 'bold');
            const nameLines = doc.splitTextToSize(`${index + 1}. ${doctor.name}`, pageWidth - 2 * margin);
            doc.text(nameLines, margin, y);
            y += nameLines.length * 6;

            doc.setFont('helvetica', 'normal');
            const addressLines = doc.splitTextToSize(`   Adresse : ${doctor.vicinity}`, pageWidth - 2 * margin);
            doc.text(addressLines, margin, y);
            y += addressLines.length * 6;

            y += 4;
          });
        } else {
          doc.text("Aucun médecin trouvé à proximité.", margin, y);
          y += 6;
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des médecins:", error);
        doc.text("Impossible de récupérer la liste des médecins.", margin, y);
        y += 6;
      }

      y += 10;
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(11);
      doc.text("Merci d'utiliser DermaScan AI.", margin, y);

      // Pied de page
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text("Rapport généré automatiquement - DermaScan AI", pageWidth / 2, 290, { align: "center" });

      // Sauvegarde du PDF
      const fileName = `rapport_${userData.nom || "patient"}_${historyItem.id}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      alert("Erreur lors de la génération du rapport PDF.");
    }
  };

  // Fonction pour récupérer l'image avec les bons headers
  const fetchPredictionImage = async (predictionId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/prediction/${predictionId}/image`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.status === 404) {
        console.log("Image non trouvée pour la prédiction:", predictionId);
        setImageUrl(null);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    } catch (error) {
      console.error("Erreur lors de la récupération de l'image:", error);
      setImageUrl(null);
    }
  };

  // Mettre à jour l'image quand une prédiction est sélectionnée
  React.useEffect(() => {
    if (selectedHistory?.id) {
      fetchPredictionImage(selectedHistory.id);
    } else {
      setImageUrl(null);
    }
  }, [selectedHistory]);

  // Nettoyer l'URL de l'image quand le composant est démonté
  React.useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-blue-100 via-white to-green-50 flex flex-col text-gray-800">
      {/* Header medical-themed bar */}
      <div className="w-full flex items-center justify-between px-8 py-4 bg-gradient-to-r from-blue-200 via-white to-green-200 shadow-md z-30 relative">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-400 shadow">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <rect x="9" y="2" width="6" height="20" rx="3" fill="#22c55e" />
              <rect x="2" y="9" width="20" height="6" rx="3" fill="#38bdf8" />
            </svg>
          </span>
          <span className="text-2xl font-bold text-blue-800 tracking-wide">
            DermaScan AI
          </span>
        </div>
        {/* Menu responsive et innovant */}
        <div className="relative">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold shadow transition md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
          >
            <Menu size={24} />
          </button>
          <div className="hidden md:flex items-center gap-4">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold shadow transition"
              onClick={fetchHistory}
              title="Voir l'historique"
            >
              <History size={20} /> Historique
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 font-semibold shadow transition"
              onClick={handleProfile}
              title="Profil"
            >
              <User size={20} /> Profil
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold shadow transition"
              onClick={handleDownload}
              title="Télécharger le rapport"
            >
              <Download size={20} /> Rapport
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-semibold shadow transition"
              onClick={handleLogout}
              title="Déconnexion"
            >
              <LogOut size={20} /> Déconnexion
            </button>
          </div>
          {/* Menu mobile flottant */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-blue-100 flex flex-col z-50 animate-fade-in-fast">
              <button
                className="flex items-center gap-2 px-4 py-3 hover:bg-blue-50 text-blue-700 font-semibold rounded-t-xl"
                onClick={() => { setMenuOpen(false); fetchHistory(); }}
              >
                <History size={20} /> Historique
              </button>
              <button
                className="flex items-center gap-2 px-4 py-3 hover:bg-green-50 text-green-700 font-semibold"
                onClick={() => { setMenuOpen(false); handleProfile(); }}
              >
                <User size={20} /> Profil
              </button>
              <button
                className="flex items-center gap-2 px-4 py-3 hover:bg-blue-50 text-blue-700 font-semibold"
                onClick={() => { setMenuOpen(false); handleDownload(); }}
              >
                <Download size={20} /> Rapport
              </button>
              <button
                className="flex items-center gap-2 px-4 py-3 hover:bg-red-50 text-red-700 font-semibold rounded-b-xl"
                onClick={() => { setMenuOpen(false); handleLogout(); }}
              >
                <LogOut size={20} /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Titre de bienvenue avec le prénom */}
      <div className="w-full flex justify-center mt-6">
        <div className="bg-blue-200/60 px-8 py-4 rounded-2xl shadow text-2xl font-bold text-blue-800 tracking-wide">
          {(() => {
            try {
              const payload = JSON.parse(atob(token.split(".")[1]));
              if (payload.prenom) return `Bienvenue, ${payload.prenom} !`;
              if (payload.nom) return `Bienvenue, ${payload.nom} !`;
              return "Bienvenue !";
            } catch {
              return "Bienvenue !";
            }
          })()}
        </div>
      </div>
      {/* Zone de prédiction en entête, largeur max */}
      <div className="flex-grow flex flex-col w-full max-w-5xl mx-auto">
        <div className="w-full bg-white rounded-3xl shadow-2xl p-10 border border-blue-100 mt-8 relative flex flex-col items-center">
          <h2 className="text-3xl font-extrabold text-center text-blue-700 tracking-tight drop-shadow bg-blue-50 py-2 rounded-xl w-full">
            Analyse Dermatologique
          </h2>

          <label
            htmlFor="image-upload"
            className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-blue-300 rounded-2xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition group relative overflow-hidden mt-6"
          >
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            {preview ? (
              <img
                src={preview}
                alt="Aperçu"
                className="h-full max-h-52 object-contain rounded-2xl shadow-lg transition-transform duration-500 scale-100 group-hover:scale-105 animate-zoom-in bg-white"
                style={{
                  transition: "transform 0.5s cubic-bezier(.4,2,.6,1)",
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-blue-500 animate-fade-in-slow">
                <ImagePlus size={48} className="mb-2 animate-bounce" />
                <p className="text-base font-medium">
                  Glisser ou cliquer pour ajouter une image
                </p>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-blue-100/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
          </label>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-green-500 text-white py-3 rounded-xl hover:from-blue-700 hover:to-green-600 transition disabled:opacity-50 shadow-lg font-semibold text-lg mt-6"
          >
            {loading && <Loader2 className="animate-spin" />}
            {loading ? "Analyse en cours..." : "Analyser l'image"}
          </button>
        </div>
        {/* Résultat et conseils prennent tout l'espace restant */}
        <div className="flex-grow flex flex-col items-center justify-center w-full mt-8">
          {result && (
            <div className="w-full bg-green-50 border border-green-300 rounded-3xl p-8 shadow-md animate-fade-in-fast flex flex-col items-start space-y-2 overflow-x-auto">
              <h3 className="text-xl font-semibold text-green-700 mb-2">
                Résultat :
              </h3>
              <p>
                <span className="font-medium text-gray-800">
                  Maladie prédite :
                </span>{" "}
                <span className="text-blue-700 break-words">
                  {cleanDiseaseName(result.predicted_class_name || result.prediction)}
                </span>
              </p>
              {result.confidence !== undefined && (
                <p>
                  <span className="font-medium text-gray-800">Confiance :</span>{" "}
                  <span className="text-green-700">
                    {typeof result.confidence === "number"
                      ? (result.confidence <= 1
                          ? (result.confidence * 100).toFixed(2)
                          : result.confidence.toFixed(2))
                      : result.confidence}
                    %
                  </span>
                </p>
              )}
              {/* Conseils médicaux détaillés */}
              {typeof result.advice !== "undefined" && result.advice ? (
                <div className="w-full mt-4 animate-fade-in-fast">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={22} className="text-blue-500 animate-pulse" />
                    <span className="text-lg font-bold text-blue-700">
                      Conseil médical
                    </span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-inner text-blue-800 font-medium animate-slide-in-down">
                    {typeof result.advice === "string"
                      ? result.advice
                      : (
                          <>
                            {result.advice.description && (
                              <div className="mb-2">
                                <span className="font-semibold">Description : </span>
                                {result.advice.description}
                              </div>
                            )}
                            {Array.isArray(result.advice.conseils) && (
                              <div className="mb-2">
                                <span className="font-semibold">Conseils :</span>
                                <ul className="list-disc ml-6">
                                  {result.advice.conseils.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {result.advice.gravite && (
                              <div className="mb-2">
                                <span className="font-semibold">Gravité : </span>
                                {result.advice.gravite}
                              </div>
                            )}
                            {result.advice.recommandation && (
                              <div>
                                <span className="font-semibold">Recommandation : </span>
                                {result.advice.recommandation}
                              </div>
                            )}
                          </>
                        )
                    }
                  </div>
                </div>
              ) : (
                // Si pas de conseils dans result.advice, tente de charger depuis le JSON comme dans l'historique
                <HistoryAdviceDetails prediction={{ predicted_class: result.predicted_class_name || result.prediction }} token={token} />
              )}
              {/* Liens utiles pour la maladie prédite (sous les conseils) */}
              <DiseaseLinks diseaseName={result.predicted_class_name || result.prediction} />
              {/* Carte Google Maps des médecins proches pour la maladie prédite */}
              <NearbyDoctorsMap
                disease={result.predicted_class_name || result.prediction}
                apiKey="AIzaSyAn8GS5TJ755yNM62bvXAq57qh2E-mUp0s"
              />
            </div>
          )}
        </div>
      </div>
      {/* Historique des prédictions : liste déroulante (drawer) à droite */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex justify-end items-stretch bg-black/30 animate-fade-in-fast"
          onClick={() => { setShowHistory(false); setSelectedHistory(null); }}
        >
          <div
            className="relative h-full w-96 max-w-full bg-white shadow-2xl transition-all duration-500 ease-in-out rounded-l-3xl flex flex-col"
            onClick={e => e.stopPropagation()} // Empêche la fermeture si on clique dans le drawer
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-gradient-to-r from-blue-100 via-white to-green-100 rounded-tr-2xl">
              <h3 className="text-xl font-bold text-blue-700 flex items-center gap-2">
                <History size={22} /> Historique de vos prédictions
              </h3>
              
            </div>
            <div className="p-6 overflow-y-auto h-[calc(100%-64px)]">
              {loadingHistory ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-gray-500 text-center">
                  Aucune prédiction enregistrée.
                </div>
              ) : selectedHistory ? (
                // Affichage détail d'une prédiction sélectionnée
                <div className="animate-fade-in-fast">
                  <button
                    className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold shadow transition"
                    onClick={() => setSelectedHistory(null)}
                  >
                    <ArrowLeft size={18} /> Retour à la liste
                  </button>
                  
                  {/* Ajout de l'image */}
                  {selectedHistory.id && (
                    <div className="mb-4">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="Image de la prédiction"
                          className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                        />
                      ) : (
                        <div className="text-center p-4 bg-gray-100 rounded-lg">
                          <p className="text-gray-600 mb-2">Image non disponible</p>
                          <p className="text-sm text-gray-500">L'image de cette prédiction n'a pas été conservée sur le serveur</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold">Maladie prédite : </span>
                      <span className="text-blue-700">{cleanDiseaseName(selectedHistory.predicted_class)}</span>
                    </div>
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold shadow transition"
                      onClick={() => handleDeleteHistory(selectedHistory.id)}
                      title="Supprimer cette prédiction"
                    >
                      <Trash2 size={16} /> Supprimer
                    </button>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Date : </span>
                    <span>{selectedHistory.date}</span>
                  </div>
                  {selectedHistory.confidence && (
                    <div className="mb-2">
                      <span className="font-semibold">Confiance : </span>
                      <span className="text-green-700">{selectedHistory.confidence}</span>
                    </div>
                  )}
                  {selectedHistory.image_name && (
                    <div className="mb-2">
                      <span className="font-semibold">Image : </span>
                      <span className="text-gray-600">{selectedHistory.image_name}</span>
                    </div>
                  )}
                  {/* Conseils et détails IA */}
                  <HistoryAdviceDetails prediction={selectedHistory} token={token} />
                  {/* Liens utiles pour la maladie prédite dans l'historique */}
                  <DiseaseLinks diseaseName={cleanDiseaseName(selectedHistory.predicted_class)} />
                  {/* Carte Google Maps des médecins proches pour la maladie prédite dans l'historique */}
                  <NearbyDoctorsMap
                    disease={cleanDiseaseName(selectedHistory.predicted_class)}
                    apiKey="AIzaSyAn8GS5TJ755yNM62bvXAq57qh2E-mUp0s"
                  />
                </div>
              ) : (
                <ul className="divide-y">
                  {history.map((h) => (
                    <li key={h.id} className="py-2 flex items-center justify-between hover:bg-blue-50 rounded transition group">
                      <div
                        className="flex flex-col cursor-pointer flex-1"
                        onClick={() => setSelectedHistory(h)}
                      >
                        <span className="font-semibold text-blue-700">
                          {cleanDiseaseName(h.predicted_class)}
                        </span>
                        <span className="text-sm text-gray-500">{h.date}</span>
                        {h.confidence && (
                          <span className="text-xs text-green-700">
                            Confiance : {h.confidence}
                          </span>
                        )}
                        {h.image_name && (
                          <span className="text-xs text-gray-400">
                            Image : {h.image_name}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                      <button
                          className="ml-2 flex items-center gap-1 px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold shadow transition"
                          onClick={(e) => { e.stopPropagation(); handleDownloadHistory(h); }}
                          title="Télécharger le rapport"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="ml-2 flex items-center gap-1 px-2 py-1 rounded bg-red-50 hover:bg-red-200 text-red-600 text-xs font-bold shadow transition"
                          onClick={(e) => { e.stopPropagation(); handleDeleteHistory(h.id); }}
                          title="Supprimer cette prédiction"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in-fast" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-200 max-w-sm w-full p-8 flex flex-col items-center animate-fade-in-fast relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
              <span className="text-xl font-bold text-red-700">Suppression</span>
            </div>
            <div className="text-gray-700 text-center mb-6">Êtes-vous sûr de vouloir supprimer cette prédiction ?<br/>Cette action est irréversible.</div>
            <div className="flex gap-4 w-full justify-center">
              <button
                className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold shadow transition"
                onClick={() => { setShowDeleteModal(false); setPendingDeleteId(null); }}
              >
                Annuler
              </button>
              <button
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shadow transition"
                onClick={confirmDeleteHistory}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Profile modal - version innovante */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setProfileOpen(false)}>
          <ProfileContent token={token} onClose={() => setProfileOpen(false)} />
        </div>
      )}
      {/* Animations CSS */}
      <style>
        {`
          html, body, #root {
            height: 100%;
            min-height: 100%;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .min-h-screen {
            min-height: 100vh;
          }
          .flex-grow {
            flex-grow: 1;
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(20px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .animate-fade-in { animation: fade-in 0.8s cubic-bezier(.4,2,.6,1); }
          .animate-fade-in-fast { animation: fade-in 0.4s cubic-bezier(.4,2,.6,1); }
          .animate-fade-in-slow { animation: fade-in 1.2s cubic-bezier(.4,2,.6,1); }
          @keyframes slide-in-down {
            from { opacity: 0; transform: translateY(-24px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .animate-slide-in-down { animation: slide-in-down 0.5s cubic-bezier(.4,2,.6,1); }
          @keyframes zoom-in {
            from { transform: scale(0.95);}
            to { transform: scale(1);}
          }
          .animate-zoom-in { animation: zoom-in 0.7s cubic-bezier(.4,2,.6,1); }
          .drawer-open {
            transform: translateX(0);
          }
          .drawer-closed {
            transform: translateX(100%);
          }
        `}
      </style>
    </div>
  );
};

// Affiche les conseils/détails pour une prédiction historique
function HistoryAdviceDetails({ prediction, token }: { prediction: any, token: string }) {
  const [advice, setAdvice] = useState<any | null>(null);

  React.useEffect(() => {
    // Utilise le nom de la maladie en minuscules et sans accents pour matcher la clé du JSON
    function normalize(s: string) {
      return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // retire les accents
        .replace(/[^a-z0-9]/g, ""); // retire tout sauf lettres/chiffres
    }
    let key = null;
    if (prediction.predicted_class) {
      const predNorm = normalize(prediction.predicted_class);
      fetch("/disease_advice.json")
        .then(res => res.json())
        .then(json => {
          key = Object.keys(json).find(k => normalize(k) === predNorm || predNorm.includes(normalize(k)) || normalize(k).includes(predNorm));
          if (key) setAdvice(json[key]);
          else setAdvice(null);
        })
        .catch(() => setAdvice(null));
    } else {
      setAdvice(null);
    }
  }, [prediction]);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Info size={22} className="text-blue-500 animate-pulse" />
        <span className="text-lg font-bold text-blue-700">Conseil médical</span>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-inner text-blue-800 font-medium animate-slide-in-down">
        {advice ? (
          <>
            {advice.description && (
              <div className="mb-2">
                <span className="font-semibold">Description : </span>
                {advice.description}
              </div>
            )}
            {Array.isArray(advice.conseils) && (
              <div className="mb-2">
                <span className="font-semibold">Conseils :</span>
                <ul className="list-disc ml-6">
                  {advice.conseils.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {advice.gravite && (
              <div className="mb-2">
                <span className="font-semibold">Gravité : </span>
                {advice.gravite}
              </div>
            )}
            {advice.recommandation && (
              <div>
                <span className="font-semibold">Recommandation : </span>
                {advice.recommandation}
              </div>
            )}
          </>
        ) : (
          <span>Aucun conseil spécifique pour cette maladie.</span>
        )}
      </div>
    </div>
  );
}

// Affiche des liens utiles (articles/blogs/vidéos) pour la maladie prédite
function DiseaseLinks({ diseaseName }: { diseaseName: string }) {
  const [links, setLinks] = useState<{ title: string; url: string; type?: string }[] | null>(null);

  React.useEffect(() => {
    if (!diseaseName) return setLinks(null);
    fetch("/disease_links.json")
      .then(res => res.json())
      .then(json => {
        // Recherche intelligente : match partiel sur le nom (ignore numéros, tirets, etc)
        const clean = (s: string) =>
          s
            .toLowerCase()
            .replace(/^\d+\.\s*/, "")
            .replace(/-.*$/, "")
            .replace(/[()]/g, "")
            .replace(/[^a-z\s]/gi, "")
            .trim();
        const diseaseClean = clean(diseaseName);
        let key = Object.keys(json).find(k => clean(k) === diseaseClean);
        if (!key) {
          // Si pas trouvé, essaie un match partiel
          key = Object.keys(json).find(k => clean(k).includes(diseaseClean) || diseaseClean.includes(clean(k)));
        }
        if (key && Array.isArray(json[key])) setLinks(json[key]);
        else setLinks(null);
      })
      .catch(() => setLinks(null));
  }, [diseaseName]);

  if (!links || links.length === 0) return null;

  return (
    <div className="w-full mt-6 animate-fade-in-fast">
      <div className="flex items-center gap-2 mb-2">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" className="text-blue-500">
          <circle cx="12" cy="12" r="10" fill="#38bdf8" />
          <path d="M8 12h8M12 8v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-lg font-bold text-blue-700">Liens utiles</span>
      </div>
      <ul className="space-y-2">
        {links.map((l, i) => (
          <li key={i}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold shadow transition border border-blue-200"
              style={{ textDecoration: "none" }}
            >
              {l.type === "video" && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="2" fill="#38bdf8" />
                  <polygon points="10,9 16,12 10,15" fill="#fff" />
                </svg>
              )}
              {l.type === "article" && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" rx="2" fill="#22c55e" />
                  <rect x="7" y="8" width="10" height="2" fill="#fff" />
                  <rect x="7" y="12" width="7" height="2" fill="#fff" />
                </svg>
              )}
              {l.type === "blog" && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" fill="#eab308" />
                  <rect x="9" y="11" width="6" height="2" fill="#fff" />
                </svg>
              )}
              <span className="truncate">{l.title}</span>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" className="ml-auto">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Affiche une carte Google Maps avec les médecins proches spécialisés dans la maladie prédite
function NearbyDoctorsMap({ disease, apiKey }: { disease: string, apiKey: string }) {
  const [userPos, setUserPos] = React.useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [places, setPlaces] = React.useState<any[]>([]);
  const [showCount, setShowCount] = React.useState(3);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [selectedDoctor, setSelectedDoctor] = React.useState<any | null>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const mapRef = React.useRef<HTMLDivElement>(null);

  function getSpecialty(disease: string) {
    if (!disease) return "dermatologue";
    const d = disease.toLowerCase();
    if (
      d.includes("acne") ||
      d.includes("eczema") ||
      d.includes("psoriasis") ||
      d.includes("melanoma") ||
      d.includes("dermatitis") ||
      d.includes("keratosis") ||
      d.includes("tinea") ||
      d.includes("warts") ||
      d.includes("seborrheic")
    ) {
      return "dermatologue";
    }
    return "médecin";
  }

  React.useEffect(() => {
    if (!userPos) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          err => setError("Impossible de récupérer votre position. Veuillez autoriser la géolocalisation dans votre navigateur.")
        );
      } else {
        setError("La géolocalisation n'est pas supportée par votre navigateur.");
      }
    }
  }, [userPos]);

  React.useEffect(() => {
    if (!userPos || !mapRef.current) return;

    const scriptId = "google-maps-js";
    function handleScriptError() {
      setLoadError("Google Maps ne s'est pas chargé correctement sur cette page. Vérifiez la console pour plus d'informations.");
    }
    function initMap() {
      // @ts-ignore
      const google = window.google;
      if (!google || !google.maps) {
        setLoadError("Google Maps ne s'est pas chargé correctement sur cette page. Vérifiez la console pour plus d'informations.");
        return;
      }
      setLoadError(null);
      const map = new google.maps.Map(mapRef.current, {
        center: userPos,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      // Marqueur utilisateur
      new google.maps.Marker({
        position: userPos,
        map,
        label: {
          text: "Vous",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "14px"
        },
        icon: {
          url: "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png"
        }
      });

      // Recherche des médecins proches
      const service = new google.maps.places.PlacesService(map);
      service.nearbySearch(
        {
          location: userPos,
          radius: 5000,
          keyword: getSpecialty(disease),
          type: "doctor"
        },
        (results: any, status: any) => {
          if (status === "OK" && Array.isArray(results)) {
            setPlaces(results);
            results.forEach((place: any, idx: number) => {
              const marker = new google.maps.Marker({
                position: place.geometry.location,
                map,
                title: place.name,
                icon: {
                  url: "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png"
                }
              });
              // Affiche une info-bulle au clic
              const info = new google.maps.InfoWindow({
                content: `<div style="font-weight:bold;color:#2563eb">${place.name}</div>
                  <div style="font-size:13px;color:#444">${place.vicinity || ""}</div>
                  ${place.rating ? `<div style="font-size:12px;color:#888">Note: ${place.rating} ⭐</div>` : ""}
                  ${place.user_ratings_total ? `<div style="font-size:12px;color:#888">(${place.user_ratings_total} avis)</div>` : ""}
                `
              });
              marker.addListener("click", () => {
                info.open(map, marker);
              });
              if (idx === 0) {
                setTimeout(() => info.open(map, marker), 500);
              }
            });
          }
        }
      );
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onerror = handleScriptError;
      script.onload = () => initMap();
      document.body.appendChild(script);
    } else {
      try {
        initMap();
      } catch {
        setLoadError("Google Maps ne s'est pas chargé correctement sur cette page. Vérifiez la console pour plus d'informations.");
      }
    }
    // eslint-disable-next-line
  }, [userPos, disease, apiKey]);

  React.useEffect(() => {
    if (!places.length) return;
    const handleScroll = () => {
      if (!listRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 10 && showCount < places.length && !loadingMore) {
        setLoadingMore(true);
        setTimeout(() => {
          setShowCount(c => Math.min(c + 5, places.length));
          setLoadingMore(false);
        }, 350);
      }
    };
    const ref = listRef.current;
    if (ref) ref.addEventListener("scroll", handleScroll);
    return () => {
      if (ref) ref.removeEventListener("scroll", handleScroll);
    };
  }, [places.length, showCount, loadingMore]);

  const visiblePlaces = places.slice(0, showCount);

  return (
    <div className="w-full mt-8">
      <div className="flex items-center gap-2 mb-2">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" className="text-green-500">
          <circle cx="12" cy="12" r="10" fill="#22c55e" />
          <path d="M12 8v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-lg font-bold text-green-700">Médecins proches spécialisés</span>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      {loadError && (
        <div className="text-red-600 font-semibold">
          Petit problème... Une erreur s'est produite<br />
          Google Maps ne s'est pas chargé correctement sur cette page.<br />
          <span className="text-xs">Pour plus d'informations techniques sur cette erreur, veuillez consulter la console JavaScript.</span>
        </div>
      )}
      {!userPos && !error && !loadError && (
        <div className="text-gray-500">Recherche de votre position...</div>
      )}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: 340,
          borderRadius: 16,
          border: "2px solid #bae6fd",
          boxShadow: "0 2px 12px 0 #e0f2fe",
          marginTop: 8,
        }}
      />
      {/* Liste des médecins sous la carte, lazy loading façon YouTube */}
      {places.length > 0 && (
        <div className="mt-4">
          <div className="text-base font-bold text-green-700 mb-2">Liste des médecins trouvés :</div>
          <ul
            ref={listRef}
            className="space-y-2"
            style={{
              maxHeight: 320,
              overflowY: "auto",
              paddingRight: 4,
              scrollBehavior: "smooth"
            }}
          >
            {visiblePlaces.map((place, i) => (
              <li
                key={place.place_id || i}
                className={`bg-green-50 border border-green-200 rounded-xl px-4 py-2 shadow flex flex-col animate-fade-in-fast cursor-pointer transition hover:bg-blue-50 ${selectedDoctor && selectedDoctor.place_id === place.place_id ? "ring-2 ring-blue-400" : ""}`}
                onClick={() => setSelectedDoctor(place)}
              >
                <span className="font-semibold text-blue-800">{place.name}</span>
                <span className="text-sm text-gray-700">{place.vicinity}</span>
                {place.rating && (
                  <span className="text-xs text-yellow-600">Note : {place.rating} ⭐ ({place.user_ratings_total || 0} avis)</span>
                )}
                {place.opening_hours && place.opening_hours.open_now !== undefined && (
                  <span className={`text-xs font-semibold ${place.opening_hours.open_now ? "text-green-700" : "text-red-600"}`}>
                    {place.opening_hours.open_now ? "Ouvert" : "Fermé"}
                  </span>
                )}
              </li>
            ))}
            {loadingMore && (
              <li className="flex justify-center py-2">
                <span className="text-blue-400 animate-pulse">Chargement...</span>
              </li>
            )}
          </ul>
          {showCount < places.length && !loadingMore && (
            <button
              className="mt-3 px-4 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold shadow transition w-full"
              onClick={() => setShowCount(c => Math.min(c + 5, places.length))}
            >
              Afficher plus
            </button>
          )}
          {showCount > 3 && (
            <button
              className="mt-2 ml-2 px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold shadow transition"
              onClick={() => setShowCount(3)}
            >
              Réduire
            </button>
          )}
        </div>
      )}
      {/* Affichage des commentaires Google sur le médecin sélectionné */}
      {selectedDoctor && (
        <DoctorReviews doctor={selectedDoctor} onClose={() => setSelectedDoctor(null)} />
      )}
      <div className="text-xs text-gray-500 mt-2">
        Les résultats sont fournis par Google Maps selon votre position et la spécialité recherchée.
      </div>
    </div>
  );
}

// Affiche les avis Google pour un médecin (si disponibles)
function DoctorReviews({ doctor, onClose }: { doctor: any, onClose: () => void }) {
  const [details, setDetails] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setDetails(null);
    setLoading(true);
    // @ts-ignore
    if (window.google && window.google.maps && doctor.place_id) {
      const service = new window.google.maps.places.PlacesService(document.createElement("div"));
      service.getDetails(
        { placeId: doctor.place_id, fields: ["name", "reviews", "rating", "user_ratings_total", "formatted_address"] },
        (res: any, status: any) => {
          if (status === "OK") setDetails(res);
          else setDetails(null);
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
    }
  }, [doctor]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-blue-200 max-w-lg w-full p-6 animate-fade-in-fast relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700"
          onClick={onClose}
          title="Fermer"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h3 className="text-xl font-bold text-blue-700 mb-2 flex items-center gap-2">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="#38bdf8" />
            <path d="M8 12h8M12 8v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {doctor.name}
        </h3>
        <div className="text-sm text-gray-700 mb-2">{doctor.vicinity || details?.formatted_address}</div>
        {loading && <div className="text-blue-400 animate-pulse">Chargement des avis...</div>}
        {!loading && details && Array.isArray(details.reviews) && details.reviews.length > 0 ? (
          <div className="space-y-4 max-h-72 overflow-y-auto">
            {details.reviews.map((r: any, i: number) => (
              <div key={i} className="bg-blue-50 border-l-4 border-blue-300 rounded-lg p-3 shadow">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-blue-800">{r.author_name}</span>
                  <span className="text-yellow-600 text-xs">{r.rating} ⭐</span>
                  <span className="text-gray-400 text-xs">{new Date(r.time * 1000).toLocaleDateString()}</span>
                </div>
                <div className="text-gray-700 text-sm">{r.text}</div>
              </div>
            ))}
          </div>
        ) : !loading && (
          <div className="text-gray-500 italic">Aucun avis Google disponible pour ce médecin.</div>
        )}
      </div>
    </div>
  );
}

// Ajoute ce composant à la fin du fichier
function ProfileContent({ token, onClose }: { token: string; onClose: () => void }) {
  let payload: any = {};
  try {
    payload = JSON.parse(atob(token.split(".")[1]));
  } catch {}

  // Récupère les infos utilisateur depuis la table users (backend)
  const [userInfo, setUserInfo] = React.useState<{ nom?: string; prenom?: string; sexe?: string; age?: string; email?: string; telephone?: string; role?: string } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:8000/users", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const users = await res.json();
        const email = payload.sub;
        const user = users.find((u: any) => u.email === email);
        setUserInfo(user || {});
      } catch {
        setUserInfo({});
      }
      setLoading(false);
    };
    fetchUser();
    // eslint-disable-next-line
  }, [token]);

  const [edit, setEdit] = React.useState(false);
  const [form, setForm] = React.useState({
    nom: userInfo?.nom || "",
    prenom: userInfo?.prenom || "",
    sexe: userInfo?.sexe || "",
    age: userInfo?.age || "",
    telephone: userInfo?.telephone || "",
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm({
      nom: userInfo?.nom || "",
      prenom: userInfo?.prenom || "",
      sexe: userInfo?.sexe || "",
      age: userInfo?.age || "",
      telephone: userInfo?.telephone || "",
    });
  }, [userInfo]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("http://localhost:8000/users/update_profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erreur lors de la sauvegarde");
      setMsg("Profil mis à jour !");
      setEdit(false);
      // Recharge les infos utilisateur après modification
      const usersRes = await fetch("http://localhost:8000/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const users = await usersRes.json();
      const email = payload.sub;
      const user = users.find((u: any) => u.email === email);
      setUserInfo(user || {});
    } catch (e) {
      setMsg("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  return (
    <div
      className="relative bg-gradient-to-br from-blue-50 via-white to-green-50 rounded-3xl shadow-2xl border-2 border-blue-200 max-w-lg w-full p-10 animate-fade-in-fast flex flex-col items-center"
      onClick={e => e.stopPropagation()}
    >
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 shadow"
        onClick={onClose}
        title="Fermer"
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
          <path d="M18 6L6 18M6 6l12 12" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-300 via-green-200 to-blue-100 flex items-center justify-center shadow-lg mb-2 border-4 border-blue-200">
          <User size={48} className="text-blue-700" />
        </div>
        <h3 className="text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">Mon profil</h3>
        <div className="text-blue-500 font-semibold text-base">Bienvenue sur votre espace personnel</div>
      </div>
      {loading ? (
        <div className="text-blue-400 text-center py-8">Chargement...</div>
      ) : (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 bg-white/70 border border-blue-100 rounded-2xl p-6 shadow-inner relative">
          {!edit && (
            <button
              className="absolute top-3 right-3 p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 shadow transition"
              onClick={() => setEdit(true)}
              title="Modifier mon profil"
              type="button"
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                <path d="M16.862 5.487a2.06 2.06 0 0 1 2.915 2.914l-9.193 9.193a2 2 0 0 1-.707.464l-3.07 1.025a.5.5 0 0 1-.634-.634l-1.025-3.07a2 2 0 0 1 .464-.707l9.2-9.185Z" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <div>
            <span className="font-semibold text-blue-700">Email :</span>
            <div className="text-gray-900 break-all">{userInfo?.email || <span className="text-gray-400">-</span>}</div>
          </div>
          <div>
            <span className="font-semibold text-blue-700">Nom :</span>
            {edit ? (
              <input
                name="nom"
                value={form.nom}
                onChange={handleChange}
                className="w-full border border-blue-200 rounded px-2 py-1 mt-1 bg-white text-gray-900"
                style={{ background: "#fff", color: "#222" }}
              />
            ) : (
              <div className="text-gray-900">{userInfo?.nom || <span className="text-gray-400">-</span>}</div>
            )}
          </div>
          <div>
            <span className="font-semibold text-blue-700">Prénom :</span>
            {edit ? (
              <input
                name="prenom"
                value={form.prenom}
                onChange={handleChange}
                className="w-full border border-blue-200 rounded px-2 py-1 mt-1 bg-white text-gray-900"
                style={{ background: "#fff", color: "#222" }}
              />
            ) : (
              <div className="text-gray-900">{userInfo?.prenom || <span className="text-gray-400">-</span>}</div>
            )}
          </div>
          <div>
            <span className="font-semibold text-blue-700">Téléphone :</span>
            {edit ? (
              <input
                name="telephone"
                value={form.telephone}
                onChange={handleChange}
                className="w-full border border-blue-200 rounded px-2 py-1 mt-1 bg-white text-gray-900"
                style={{ background: "#fff", color: "#222" }}
              />
            ) : (
              <div className="text-gray-900">{userInfo?.telephone || <span className="text-gray-400">-</span>}</div>
            )}
          </div>
          <div>
            <span className="font-semibold text-blue-700">Sexe :</span>
            {edit ? (
              <select
                name="sexe"
                value={form.sexe}
                onChange={handleChange}
                className="w-full border border-blue-200 rounded px-2 py-1 mt-1 bg-white text-gray-900"
                style={{ background: "#fff", color: "#222" }}
              >
                <option value="">-</option>
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
              </select>
            ) : (
              <div className="text-gray-900">{userInfo?.sexe || <span className="text-gray-400">-</span>}</div>
            )}
          </div>
          <div>
            <span className="font-semibold text-blue-700">Âge :</span>
            {edit ? (
              <input
                name="age"
                type="number"
                min={0}
                value={form.age}
                onChange={handleChange}
                className="w-full border border-blue-200 rounded px-2 py-1 mt-1 bg-white text-gray-900"
                style={{ background: "#fff", color: "#222" }}
              />
            ) : (
              <div className="text-gray-900">{userInfo?.age || <span className="text-gray-400">-</span>}</div>
            )}
          </div>
          <div>
            <span className="font-semibold text-blue-700">Rôle :</span>
            <div className="text-gray-900 capitalize">{userInfo?.role || <span className="text-gray-400">-</span>}</div>
          </div>
          <div className="col-span-2 flex gap-3 mt-4">
            {edit && (
              <>
                <button
                  className="px-5 py-2 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 font-bold shadow transition"
                  onClick={handleSave}
                  disabled={saving}
                  type="button"
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold shadow transition"
                  onClick={() => { setEdit(false); setMsg(null); setForm({ nom: userInfo?.nom || "", prenom: userInfo?.prenom || "", sexe: userInfo?.sexe || "", age: userInfo?.age || "", telephone: userInfo?.telephone || "" }); }}
                  type="button"
                >
                  Annuler
                </button>
              </>
            )}
            {msg && (
              <span className={`ml-4 font-semibold ${msg.includes("Erreur") ? "text-red-600" : "text-green-700"}`}>{msg}</span>
            )}
          </div>
        </div>
      )}
      <div className="mt-8 flex flex-col items-center w-full">
        <div className="w-full h-2 rounded-full bg-gradient-to-r from-blue-200 via-green-200 to-blue-100 mb-4" />
        <div className="text-xs text-gray-400 text-center">
          Vos informations sont extraites de votre compte sécurisé.<br />
          Pour modifier vos données, contactez l'administrateur ou le support.
        </div>
      </div>
    </div>
  );
}

// Fonction utilitaire pour nettoyer le nom de la maladie
function cleanDiseaseName(raw: string) {
  return raw.replace(/^\d+\.\s*/, '').replace(/\s*-?\s*\d+[a-zA-Z\. ]*$/, '').trim();
}

export default Patient;
