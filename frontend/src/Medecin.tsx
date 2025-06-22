import React, { useState, useEffect } from "react";
import { Loader2, ImagePlus, History, LogOut, User, Download, Menu, ArrowLeft, Trash2, Pencil, Check, X as Close } from "lucide-react";
import jsPDF from "jspdf";
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'http://localhost:8000';

interface Prediction {
  id: number;
  image_name: string;
  image_data: string;
  predicted_class: string;
  confidence: string;
  date: string;
  notes: string;
  top_predictions: Array<{
    class_name: string;
    confidence: number;
  }>;
  patient_nom: string;
  patient_prenom: string;
  telephone?: string;
  sexe?: string;
  age?: string;
}

// Fonction utilitaire pour nettoyer le nom de la maladie
function cleanDiseaseName(raw: string) {
  return raw.replace(/^\d+\.\s*/, '').replace(/\s*-?\s*\d+[a-zA-Z\. ]*$/, '').trim();
}

const Medecin: React.FC<{ token: string }> = ({ token }) => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Prediction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<Prediction | null>(null);
  const [patientInfo, setPatientInfo] = useState<{ nom?: string; prenom?: string; email?: string; sexe?: string; age?: string } | null>(null);
  // Ajoute un nouvel état pour les infos patient saisies par le médecin
  const [patientForm, setPatientForm] = useState({
    nom: "",
    prenom: "",
    telephone: "", // <-- change ici
    sexe: "",
    age: ""
  });
  const [patientFormTouched, setPatientFormTouched] = useState<{ [k: string]: boolean }>({});
  const [patientFormError, setPatientFormError] = useState<string | null>(null);
  const [patientFormSaved, setPatientFormSaved] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedPredictionId, setSelectedPredictionId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Récupère les infos du patient à partir du token (payload)
  useEffect(() => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setPatientInfo({
        nom: payload.nom,
        prenom: payload.prenom,
        email: payload.sub,
        sexe: payload.sexe,
        age: payload.age,
      });
    } catch {
      setPatientInfo(null);
    }
  }, [token]);

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
          "patient_nom": patientForm.nom,
          "patient_prenom": patientForm.prenom,
          "patient_telephone": patientForm.telephone,
          "patient_sexe": patientForm.sexe,
          "patient_age": patientForm.age,
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
      const payload = JSON.parse(atob(token.split(".")[1]));
      const email = payload.sub;
      // Nouvelle route pour historique enrichi
      const res = await fetch(`http://localhost:8000/history_full/${email}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data);
    } catch {
      setHistory([]);
    }
    setLoadingHistory(false);
  };

  const handleProfile = () => {
    setProfileOpen(true);
  };

  const handleDownload = async () => {
    if (!result?.prediction_id) {
      alert("Veuillez d'abord effectuer une analyse.");
      return;
    }
    try {
      // Récupère les infos de la prédiction et les notes
      const res = await fetch(`http://localhost:8000/history_full/${patientInfo?.email}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const history = await res.json();
      const prediction = history.find((h: any) => h.id === result.prediction_id);
      if (!prediction) {
        alert("Impossible de générer le rapport.");
        return;
      }
      // Récupère les notes du médecin
      const notesRes = await fetch(`http://localhost:8000/prediction/${result.prediction_id}/notes`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const notesData = await notesRes.json();

      // Récupère les JSON nécessaires pour conseils, profils et comparaisons
      const [adviceJson, profilesJson, comparisonsJson] = await Promise.all([
        fetch("/disease_advice.json").then(r => r.json()).catch(() => ({})),
        fetch("/disease_profiles.json").then(r => r.json()).catch(() => ({})),
        fetch("/comparisons.json").then(r => r.json()).catch(() => ({}))
      ]);

      // Top 3 maladies
      let top3 = [];
      try {
        top3 = Array.isArray(prediction.top_predictions)
          ? prediction.top_predictions
          : JSON.parse(prediction.top_predictions || "[]");
      } catch {
        top3 = [];
      }

      function getAllPairs(arr: string[]): [string, string][] {
        const pairs: [string, string][] = [];
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            pairs.push([arr[i], arr[j]]);
          }
        }
        return pairs;
      }

      // --- PDF PRO ---
      const doc = new jsPDF();
      let y = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 18;
      const sectionSpace = 12;

      // Logo DermaScan AI (simple carré bleu/vert)
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

      // --- Infos patient ---
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
      doc.text(`Nom : ${prediction.patient_prenom || ""} ${prediction.patient_nom || ""}`, margin, y); y += 6;
      doc.text(`Téléphone : ${prediction.telephone || ""}`, margin, y); y += 6;
      doc.text(`Sexe : ${prediction.sexe || ""}`, margin, y); y += 6;
      doc.text(`Âge : ${prediction.age || ""}`, margin, y); y += sectionSpace;

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

          // Calcule les dimensions pour que l'image tienne sur la page
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
      doc.text(`Maladie prédite : ${cleanDiseaseName(prediction.predicted_class)}`, margin, y); y += 6;
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

      // --- Top 3 maladies ---
      doc.setFontSize(13);
      doc.setTextColor(59, 130, 246);
      doc.setFont('helvetica', 'bold');
      doc.text("Top 3 maladies les plus probables", margin, y);
          y += 5;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(33, 37, 41);
      if (top3 && top3.length > 0) {
        const colors = [
          { bg: [220, 252, 231], text: [22, 163, 74] },
          { bg: [219, 234, 254], text: [37, 99, 235] },
          { bg: [254, 243, 199], text: [202, 138, 4] }
        ];
        top3.forEach((item: any, idx: number) => {
          const c = colors[idx] || { bg: [243, 244, 246], text: [55, 65, 81] };
          const boxHeight = 18;
          doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
          doc.roundedRect(margin, y, pageWidth - 2 * margin, boxHeight, 3, 3, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(c.text[0], c.text[1], c.text[2]);
          doc.text(cleanDiseaseName(item.class_name), margin + 6, y + 11);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(c.text[0], c.text[1], c.text[2]);
          doc.roundedRect(pageWidth - margin - 28, y + 2, 24, 14, 4, 4, 'FD');
          doc.setTextColor(c.text[0], c.text[1], c.text[2]);
          const conf = (item.confidence <= 1 ? (item.confidence * 100).toFixed(1) : item.confidence.toFixed(1)) + '%';
          doc.text(conf, pageWidth - margin - 16, y + 12, { align: 'center' });
          const key = Object.keys(adviceJson).find((k: string) => item.class_name.includes(k));
          if (key && adviceJson[key]?.description) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const desc = doc.splitTextToSize(adviceJson[key].description, pageWidth - 2 * margin - 12);
            doc.setFillColor(243, 244, 246);
            doc.roundedRect(margin + 4, y + boxHeight + 1, pageWidth - 2 * margin - 8, desc.length * 5 + 4, 2, 2, 'F');
            doc.text(desc, margin + 6, y + boxHeight + 6);
            y += boxHeight + desc.length * 5 + 12;
          } else {
            y += boxHeight + 6;
              }
            });
          } else {
        doc.text("Non disponible.", margin + 3, y); y += 5;
      }
      y += 2;

      // --- Tableau de profils cliniques ---
      if (top3.length >= 2) {
        function findProfileKey(disease: string) {
          let mainName = disease
            .replace(/^\d+\.\s*/, "")
            .replace(/-\s*\d+(\.\d+)?[kK]?/, "")
            .replace(/\([^)]+\)/g, "")
            .replace(/[^a-zA-Z\s]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          const diseaseWords = mainName.split(" ").filter((w: string) => w.length > 2);
          let bestKey = Object.keys(profilesJson).find((key: string) => {
            const keyLow = key.toLowerCase();
            return diseaseWords.every((word: string) => keyLow.includes(word));
          });
          if (!bestKey && diseaseWords.length > 0) {
            bestKey = Object.keys(profilesJson).find((key: string) => {
              const keyLow = key.toLowerCase();
              return diseaseWords.some((word: string) => keyLow.includes(word));
            });
          }
          if (!bestKey) {
            bestKey = Object.keys(profilesJson).find(key =>
              key.toLowerCase().startsWith(mainName.split(" ")[0])
            );
          }
          return bestKey;
        }

        const selectedProfiles = top3
          .map((d: any) => {
            const key = findProfileKey(d.class_name);
            return key ? { name: key, data: profilesJson[key] } : null;
          })
          .filter(Boolean);

        if (selectedProfiles.length >= 2) {
          const allKeys = selectedProfiles.map((p: any) => p ? Object.keys(p.data) : []);
          const commonKeys = allKeys.reduce((a: string[], b: string[]) => a.filter((k: string) => b.includes(k)), allKeys[0] || []);

          if (commonKeys.length > 0) {
            doc.addPage();
            y = 20;

            doc.setFontSize(15);
            doc.setTextColor(34, 197, 94);
            doc.setFont('helvetica', 'bold');
            doc.text("Tableau de comparaison clinique", margin, y);
            y += 7;
            doc.setDrawColor(59, 130, 246);
            doc.setLineWidth(0.7);
            doc.line(margin, y, pageWidth - margin, y);
            y += 4;
            y += 10;

            const totalCols = 1 + selectedProfiles.length;
            const tableWidth = pageWidth - 2 * margin;
            const colWidth = Math.floor(tableWidth / totalCols);
            const colWidths = Array(totalCols).fill(colWidth);
            colWidths[colWidths.length - 1] = tableWidth - colWidth * (totalCols - 1);
            let rowY = y;

            let x = margin;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            
            const headerColors = [
              [220, 252, 231],
              [219, 234, 254],
              [254, 243, 199]
            ];

            const headerLines = [doc.splitTextToSize('CRITÈRE', colWidths[0] - 6)];
            selectedProfiles.forEach((p: any, idx: number) => {
              headerLines.push(doc.splitTextToSize(p.name.toUpperCase(), colWidths[idx + 1] - 6));
        });
            const headerHeight = Math.max(...headerLines.map(l => l.length)) * 4 + 6;

            for (let c = 0; c < colWidths.length; c++) {
              const color = c === 0 ? headerColors[0] : headerColors[(c - 1) % headerColors.length];
              doc.setFillColor(color[0], color[1], color[2]);
              doc.rect(x, rowY, colWidths[c], headerHeight, 'F');
              
              doc.setTextColor(44, 62, 80);
              headerLines[c].forEach((line: string, lidx: number) => {
                doc.text(line, x + 3, rowY + 8 + lidx * 4);
              });
              x += colWidths[c];
            }
            rowY += headerHeight + 1;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            commonKeys.forEach((crit: string, idx: number) => {
              x = margin;
              const rowVals = [
                crit.toLowerCase(), 
                ...selectedProfiles.map((p: any) => (p.data[crit] || "-").toLowerCase())
              ];
              const cellHeights = rowVals.map((val, i) => {
                const split = doc.splitTextToSize(val, colWidths[i] - 8);
                return split.length * 3.2;
              });
              const rowHeight = Math.max(...cellHeights, 7) + 4;

              for (let c = 0; c < colWidths.length; c++) {
                if (idx % 2 === 0) {
                  doc.setFillColor(236, 240, 241);
      } else {
                  doc.setFillColor(255, 255, 255);
                }
                doc.rect(x, rowY, colWidths[c], rowHeight, 'F');
                
                doc.setDrawColor(200, 200, 200);
                doc.rect(x, rowY, colWidths[c], rowHeight);

                if (c === 0) {
                  doc.setTextColor(44, 62, 80);
                } else {
                  doc.setTextColor(41, 128, 185);
                }
                const split = doc.splitTextToSize(rowVals[c], colWidths[c] - 8);
                for (let l = 0; l < split.length; l++) {
                  doc.text(split[l], x + 4, rowY + 7 + l * 3.2);
                }
                x += colWidths[c];
              }
              rowY += rowHeight;

              if (rowY > 260) {
                doc.addPage();
                rowY = 20;
              }
            });
            y = rowY + 8;

            const lastColWidth = Math.max(colWidths[colWidths.length - 1], 45);
            if (lastColWidth > colWidths[colWidths.length - 1]) {
              const totalWidth = tableWidth - lastColWidth;
              const remainingCols = colWidths.length - 1;
              const newColWidth = Math.floor(totalWidth / remainingCols);
              colWidths.fill(newColWidth, 0, remainingCols);
              colWidths[colWidths.length - 1] = lastColWidth;
            }

            y += 10;
          }
        }
      }

      // --- Tableaux de comparaison entre maladies proches ---
      if (top3.length >= 2) {
        const pairs = getAllPairs(top3.map((p: any) => p.class_name));
        pairs.forEach(([d1, d2]) => {
          function getSimpleName(d: string) {
            const parts = d.split(/[ .-]/).filter(Boolean);
            if (parts.length > 1) {
              return parts[1].toLowerCase().replace(/[^a-z]/gi, "");
            }
            return d.toLowerCase().replace(/[^a-z]/gi, "");
          }
          const s1 = getSimpleName(d1);
          const s2 = getSimpleName(d2);
          const key = Object.keys(comparisonsJson).find(k => {
            const keyNorm = k
              .toLowerCase()
              .replace(/[^a-z_]/g, "")
              .split("_vs_")
              .sort()
              .join("_vs_");
            const pairNorm = [s1, s2].sort().join("_vs_");
            return keyNorm === pairNorm;
          });
          if (key) {
            const criteres = comparisonsJson[key]?.["critères"];
            if (criteres && criteres.length > 0) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(13);
              doc.setTextColor(34, 34, 34);
              doc.text(`Comparaison : ${d1} / ${d2}`, margin, y);
        y += 7;
              doc.setDrawColor(180, 180, 180);
              doc.setLineWidth(0.3);
              doc.line(margin, y, pageWidth - margin, y);
              y += 4;
              const tableWidth = pageWidth - 2 * margin;
              const colWidths = [Math.floor(tableWidth / 3), Math.floor(tableWidth / 3), tableWidth - 2 * Math.floor(tableWidth / 3)];
              const d1Lines = doc.splitTextToSize(d1, colWidths[1] - 8);
              const d2Lines = doc.splitTextToSize(d2, colWidths[2] - 8);
              const headerHeight = Math.max(d1Lines.length, d2Lines.length, 1) * 6 + 6;
              let rowY = y;
              let x = margin;
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(11);
              doc.rect(x, rowY, colWidths[0], headerHeight);
              doc.text('Critère', x + 4, rowY + 10);
              x += colWidths[0];
              doc.rect(x, rowY, colWidths[1], headerHeight);
              d1Lines.forEach((line: string, lidx: number) => {
                doc.text(line, x + 4, rowY + 10 + lidx * 6);
              });
              x += colWidths[1];
              doc.rect(x, rowY, colWidths[2], headerHeight);
              d2Lines.forEach((line: string, lidx: number) => {
                doc.text(line, x + 4, rowY + 10 + lidx * 6);
              });
              rowY += headerHeight;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              criteres.forEach((crit: any, idx: number) => {
                x = margin;
                const simple1 = getSimpleName(d1);
                const simple2 = getSimpleName(d2);
                const val1 = crit[simple1] !== undefined ? crit[simple1] : crit[d1.toLowerCase()] !== undefined ? crit[d1.toLowerCase()] : "-";
                const val2 = crit[simple2] !== undefined ? crit[simple2] : crit[d2.toLowerCase()] !== undefined ? crit[d2.toLowerCase()] : "-";
                const rowVals = [crit.nom, val1, val2];
                const cellHeights = rowVals.map((val, i) => {
                  const split = doc.splitTextToSize(val, colWidths[i] - 8);
                  return split.length * 5;
                });
                const rowHeight = Math.max(...cellHeights, 10) + 4;
                for (let c = 0; c < colWidths.length; c++) {
                  doc.rect(margin + colWidths.slice(0, c).reduce((a, b) => a + b, 0), rowY, colWidths[c], rowHeight);
                  const split = doc.splitTextToSize(rowVals[c], colWidths[c] - 8);
                  for (let l = 0; l < split.length; l++) {
                    doc.text(split[l], margin + colWidths.slice(0, c).reduce((a, b) => a + b, 0) + 4, rowY + 9 + l * 5);
                  }
                }
                rowY += rowHeight;
                if (rowY > 270) { doc.addPage(); rowY = 20; }
              });
              y = rowY + 5;
            }
          }
        });
      }

      // --- Notes du médecin ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(34, 197, 94);
      doc.text("Notes du médecin", margin, y);
      y += 7;
      doc.setDrawColor(200, 230, 201);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      if (notesData.notes && notesData.notes.length > 0) {
        notesData.notes.forEach((n: any, i: number) => {
          const noteText = `- ${n.note} (${new Date(n.date).toLocaleString("fr-FR")})`;
          const split = doc.splitTextToSize(noteText, pageWidth - 2 * margin - 8);
          doc.text(split, margin + 3, y);
          y += split.length * 6;
          if (y > 270) { doc.addPage(); y = 20; }
        });
      } else {
        doc.text("Aucune note enregistrée.", margin + 3, y); y += 7;
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
      const fileName = `rapport_${prediction.patient_nom || "patient"}_${prediction.id}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      alert("Erreur lors de la génération du rapport PDF.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
    // Forcer le rechargement de la page pour s'assurer que l'état est réinitialisé
    window.location.reload();
  };

  const handleUserManagement = () => {
    navigate("/users");
  };

  // Suppression d'une prédiction de l'historique
  const handleDeleteHistory = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/delete_prediction/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (selectedHistory && selectedHistory.id === id) setSelectedHistory(null);
    } catch {
      alert("Erreur lors de la suppression.");
    }
  };

  // Validation dynamique du formulaire patient
  const validatePatientForm = () => {
    if (!patientForm.nom.trim()) return "Le nom est requis.";
    if (!patientForm.prenom.trim()) return "Le prénom est requis.";
    if (!patientForm.telephone.trim()) return "Le numéro de téléphone est requis.";
    // Validation simple du numéro (10 chiffres, adapte si besoin)
    if (!/^\d{10,15}$/.test(patientForm.telephone)) return "Numéro de téléphone invalide.";
    if (!patientForm.sexe) return "Le sexe est requis.";
    if (!patientForm.age.trim() || isNaN(Number(patientForm.age)) || Number(patientForm.age) <= 0) return "L'âge doit être un nombre positif.";
    return null;
  };

  // Gère la modification des champs du formulaire patient
  const handlePatientFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPatientForm(prev => ({ ...prev, [name]: value }));
    setPatientFormTouched(prev => ({ ...prev, [name]: true }));
    setPatientFormError(null);
    setPatientFormSaved(false);
  };

  // Gère la soumission du formulaire patient
  const handlePatientFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePatientForm();
    if (err) {
      setPatientFormError(err);
      setPatientFormSaved(false);
      return;
    }
    setPatientFormError(null);
    setPatientFormSaved(true);

    // Appelle l'API pour créer ou récupérer le patient (pas de mot de passe)
    try {
      const res = await fetch("http://localhost:8000/patients/create_or_get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patientForm)
      });
      const data = await res.json();
      // Stocke l'id du patient pour lier à la prédiction (optionnel : setPatientId(data.id))
      // setPatientId(data.id);
    } catch (e) {
      setPatientFormError("Erreur lors de l'enregistrement du patient.");
      setPatientFormSaved(false);
    }
  };

  const handleAddNote = async (predictionId: number) => {
    setSelectedPredictionId(predictionId);
    setShowNoteModal(true);
  };

  const handleSubmitNote = async () => {
    if (!selectedPredictionId || !noteText.trim()) return;

    try {
      const response = await fetch(`${API_URL}/prediction/${selectedPredictionId}/note`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ note: noteText })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'ajout de la note');
      }

      // Rafraîchir l'historique
      fetchHistory();
      
      // Réinitialiser et fermer le modal
      setNoteText("");
      setShowNoteModal(false);
      setSelectedPredictionId(null);
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur lors de l\'ajout de la note');
    }
  };

  // Ajouter la fonction handleDownloadReport
  const handleDownloadReport = async (prediction: Prediction) => {
    try {
      // Récupère les notes du médecin
      const notesRes = await fetch(`${API_URL}/prediction/${prediction.id}/notes`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const notesData = await notesRes.json();

      // Récupère les JSON nécessaires pour conseils, profils et comparaisons
      const [adviceJson, profilesJson, comparisonsJson] = await Promise.all([
        fetch("/disease_advice.json").then(r => r.json()).catch(() => ({})),
        fetch("/disease_profiles.json").then(r => r.json()).catch(() => ({})),
        fetch("/comparisons.json").then(r => r.json()).catch(() => ({}))
      ]);

      // Top 3 maladies
      let top3 = [];
      try {
        top3 = Array.isArray(prediction.top_predictions)
          ? prediction.top_predictions
          : JSON.parse(prediction.top_predictions || "[]");
      } catch {
        top3 = [];
      }

      function getAllPairs(arr: string[]): [string, string][] {
        const pairs: [string, string][] = [];
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            pairs.push([arr[i], arr[j]]);
          }
        }
        return pairs;
      }

      // --- PDF PRO ---
      const doc = new jsPDF();
      let y = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 18;
      const sectionSpace = 12;

      // Logo DermaScan AI (simple carré bleu/vert)
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

      // --- Infos patient ---
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
      doc.text(`Nom : ${prediction.patient_prenom || ""} ${prediction.patient_nom || ""}`, margin, y); y += 6;
      doc.text(`Téléphone : ${prediction.telephone || ""}`, margin, y); y += 6;
      doc.text(`Sexe : ${prediction.sexe || ""}`, margin, y); y += 6;
      doc.text(`Âge : ${prediction.age || ""}`, margin, y); y += sectionSpace;

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

          // Calcule les dimensions pour que l'image tienne sur la page
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
      doc.text(`Maladie prédite : ${cleanDiseaseName(prediction.predicted_class)}`, margin, y); y += 6;
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

      // --- Top 3 maladies ---
      doc.setFontSize(13);
      doc.setTextColor(59, 130, 246);
      doc.setFont('helvetica', 'bold');
      doc.text("Top 3 maladies les plus probables", margin, y);
      y += 5;
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(33, 37, 41);
      if (top3 && top3.length > 0) {
        const colors = [
          { bg: [220, 252, 231], text: [22, 163, 74] },
          { bg: [219, 234, 254], text: [37, 99, 235] },
          { bg: [254, 243, 199], text: [202, 138, 4] }
        ];
        top3.forEach((item: any, idx: number) => {
          const c = colors[idx] || { bg: [243, 244, 246], text: [55, 65, 81] };
          const boxHeight = 18;
          doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
          doc.roundedRect(margin, y, pageWidth - 2 * margin, boxHeight, 3, 3, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(c.text[0], c.text[1], c.text[2]);
          doc.text(cleanDiseaseName(item.class_name), margin + 6, y + 11);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(c.text[0], c.text[1], c.text[2]);
          doc.roundedRect(pageWidth - margin - 28, y + 2, 24, 14, 4, 4, 'FD');
          doc.setTextColor(c.text[0], c.text[1], c.text[2]);
          const conf = (item.confidence <= 1 ? (item.confidence * 100).toFixed(1) : item.confidence.toFixed(1)) + '%';
          doc.text(conf, pageWidth - margin - 16, y + 12, { align: 'center' });
          const key = Object.keys(adviceJson).find((k: string) => item.class_name.includes(k));
          if (key && adviceJson[key]?.description) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const desc = doc.splitTextToSize(adviceJson[key].description, pageWidth - 2 * margin - 12);
            doc.setFillColor(243, 244, 246);
            doc.roundedRect(margin + 4, y + boxHeight + 1, pageWidth - 2 * margin - 8, desc.length * 5 + 4, 2, 2, 'F');
            doc.text(desc, margin + 6, y + boxHeight + 6);
            y += boxHeight + desc.length * 5 + 12;
          } else {
            y += boxHeight + 6;
          }
        });
      } else {
        doc.text("Non disponible.", margin + 3, y); y += 5;
      }
      y += 2;

      // --- Tableau de profils cliniques ---
      if (top3.length >= 2) {
        function findProfileKey(disease: string) {
          let mainName = disease
            .replace(/^\d+\.\s*/, "")
            .replace(/-\s*\d+(\.\d+)?[kK]?/, "")
            .replace(/\([^)]+\)/g, "")
            .replace(/[^a-zA-Z\s]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          const diseaseWords = mainName.split(" ").filter((w: string) => w.length > 2);
          let bestKey = Object.keys(profilesJson).find((key: string) => {
            const keyLow = key.toLowerCase();
            return diseaseWords.every((word: string) => keyLow.includes(word));
          });
          if (!bestKey && diseaseWords.length > 0) {
            bestKey = Object.keys(profilesJson).find((key: string) => {
              const keyLow = key.toLowerCase();
              return diseaseWords.some((word: string) => keyLow.includes(word));
            });
          }
          if (!bestKey) {
            bestKey = Object.keys(profilesJson).find(key =>
              key.toLowerCase().startsWith(mainName.split(" ")[0])
            );
          }
          return bestKey;
        }

        const selectedProfiles = top3
          .map((d: any) => {
            const key = findProfileKey(d.class_name);
            return key ? { name: key, data: profilesJson[key] } : null;
          })
          .filter(Boolean);

        if (selectedProfiles.length >= 2) {
          const allKeys = selectedProfiles.map((p: any) => p ? Object.keys(p.data) : []);
          const commonKeys = allKeys.reduce((a: string[], b: string[]) => a.filter((k: string) => b.includes(k)), allKeys[0] || []);

          if (commonKeys.length > 0) {
            doc.addPage();
            y = 20;

            doc.setFontSize(15);
            doc.setTextColor(34, 197, 94);
            doc.setFont('helvetica', 'bold');
            doc.text("Tableau de comparaison clinique", margin, y);
            y += 7;
            doc.setDrawColor(59, 130, 246);
            doc.setLineWidth(0.7);
            doc.line(margin, y, pageWidth - margin, y);
            y += 4;
            y += 10;

            const totalCols = 1 + selectedProfiles.length;
            const tableWidth = pageWidth - 2 * margin;
            const colWidth = Math.floor(tableWidth / totalCols);
            const colWidths = Array(totalCols).fill(colWidth);
            colWidths[colWidths.length - 1] = tableWidth - colWidth * (totalCols - 1);
            let rowY = y;

            let x = margin;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            
            const headerColors = [
              [220, 252, 231],
              [219, 234, 254],
              [254, 243, 199]
            ];

            const headerLines = [doc.splitTextToSize('CRITÈRE', colWidths[0] - 6)];
            selectedProfiles.forEach((p: any, idx: number) => {
              headerLines.push(doc.splitTextToSize(p.name.toUpperCase(), colWidths[idx + 1] - 6));
        });
            const headerHeight = Math.max(...headerLines.map(l => l.length)) * 4 + 6;

            for (let c = 0; c < colWidths.length; c++) {
              const color = c === 0 ? headerColors[0] : headerColors[(c - 1) % headerColors.length];
              doc.setFillColor(color[0], color[1], color[2]);
              doc.rect(x, rowY, colWidths[c], headerHeight, 'F');
              
              doc.setTextColor(44, 62, 80);
              headerLines[c].forEach((line: string, lidx: number) => {
                doc.text(line, x + 3, rowY + 8 + lidx * 4);
              });
              x += colWidths[c];
            }
            rowY += headerHeight + 1;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            commonKeys.forEach((crit: string, idx: number) => {
              x = margin;
              const rowVals = [
                crit.toLowerCase(), 
                ...selectedProfiles.map((p: any) => (p.data[crit] || "-").toLowerCase())
              ];
              const cellHeights = rowVals.map((val, i) => {
                const split = doc.splitTextToSize(val, colWidths[i] - 8);
                return split.length * 3.2;
              });
              const rowHeight = Math.max(...cellHeights, 7) + 4;

              for (let c = 0; c < colWidths.length; c++) {
                if (idx % 2 === 0) {
                  doc.setFillColor(236, 240, 241);
      } else {
                  doc.setFillColor(255, 255, 255);
                }
                doc.rect(x, rowY, colWidths[c], rowHeight, 'F');
                
                doc.setDrawColor(200, 200, 200);
                doc.rect(x, rowY, colWidths[c], rowHeight);

                if (c === 0) {
                  doc.setTextColor(44, 62, 80);
                } else {
                  doc.setTextColor(41, 128, 185);
                }
                const split = doc.splitTextToSize(rowVals[c], colWidths[c] - 8);
                for (let l = 0; l < split.length; l++) {
                  doc.text(split[l], x + 4, rowY + 7 + l * 3.2);
                }
                x += colWidths[c];
              }
              rowY += rowHeight;

              if (rowY > 260) {
                doc.addPage();
                rowY = 20;
              }
            });
            y = rowY + 8;

            const lastColWidth = Math.max(colWidths[colWidths.length - 1], 45);
            if (lastColWidth > colWidths[colWidths.length - 1]) {
              const totalWidth = tableWidth - lastColWidth;
              const remainingCols = colWidths.length - 1;
              const newColWidth = Math.floor(totalWidth / remainingCols);
              colWidths.fill(newColWidth, 0, remainingCols);
              colWidths[colWidths.length - 1] = lastColWidth;
            }

            y += 10;
          }
        }
      }

      // --- Tableaux de comparaison entre maladies proches ---
      if (top3.length >= 2) {
        const pairs = getAllPairs(top3.map((p: any) => p.class_name));
        pairs.forEach(([d1, d2]) => {
          function getSimpleName(d: string) {
            const parts = d.split(/[ .-]/).filter(Boolean);
            if (parts.length > 1) {
              return parts[1].toLowerCase().replace(/[^a-z]/gi, "");
            }
            return d.toLowerCase().replace(/[^a-z]/gi, "");
          }
          const s1 = getSimpleName(d1);
          const s2 = getSimpleName(d2);
          const key = Object.keys(comparisonsJson).find(k => {
            const keyNorm = k
              .toLowerCase()
              .replace(/[^a-z_]/g, "")
              .split("_vs_")
              .sort()
              .join("_vs_");
            const pairNorm = [s1, s2].sort().join("_vs_");
            return keyNorm === pairNorm;
          });
          if (key) {
            const criteres = comparisonsJson[key]?.["critères"];
            if (criteres && criteres.length > 0) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(13);
              doc.setTextColor(34, 34, 34);
              doc.text(`Comparaison : ${d1} / ${d2}`, margin, y);
        y += 7;
              doc.setDrawColor(180, 180, 180);
              doc.setLineWidth(0.3);
              doc.line(margin, y, pageWidth - margin, y);
              y += 4;
              const tableWidth = pageWidth - 2 * margin;
              const colWidths = [Math.floor(tableWidth / 3), Math.floor(tableWidth / 3), tableWidth - 2 * Math.floor(tableWidth / 3)];
              const d1Lines = doc.splitTextToSize(d1, colWidths[1] - 8);
              const d2Lines = doc.splitTextToSize(d2, colWidths[2] - 8);
              const headerHeight = Math.max(d1Lines.length, d2Lines.length, 1) * 6 + 6;
              let rowY = y;
              let x = margin;
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(11);
              doc.rect(x, rowY, colWidths[0], headerHeight);
              doc.text('Critère', x + 4, rowY + 10);
              x += colWidths[0];
              doc.rect(x, rowY, colWidths[1], headerHeight);
              d1Lines.forEach((line: string, lidx: number) => {
                doc.text(line, x + 4, rowY + 10 + lidx * 6);
              });
              x += colWidths[1];
              doc.rect(x, rowY, colWidths[2], headerHeight);
              d2Lines.forEach((line: string, lidx: number) => {
                doc.text(line, x + 4, rowY + 10 + lidx * 6);
              });
              rowY += headerHeight;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              criteres.forEach((crit: any, idx: number) => {
                x = margin;
                const simple1 = getSimpleName(d1);
                const simple2 = getSimpleName(d2);
                const val1 = crit[simple1] !== undefined ? crit[simple1] : crit[d1.toLowerCase()] !== undefined ? crit[d1.toLowerCase()] : "-";
                const val2 = crit[simple2] !== undefined ? crit[simple2] : crit[d2.toLowerCase()] !== undefined ? crit[d2.toLowerCase()] : "-";
                const rowVals = [crit.nom, val1, val2];
                const cellHeights = rowVals.map((val, i) => {
                  const split = doc.splitTextToSize(val, colWidths[i] - 8);
                  return split.length * 5;
                });
                const rowHeight = Math.max(...cellHeights, 10) + 4;
                for (let c = 0; c < colWidths.length; c++) {
                  doc.rect(margin + colWidths.slice(0, c).reduce((a, b) => a + b, 0), rowY, colWidths[c], rowHeight);
                  const split = doc.splitTextToSize(rowVals[c], colWidths[c] - 8);
                  for (let l = 0; l < split.length; l++) {
                    doc.text(split[l], margin + colWidths.slice(0, c).reduce((a, b) => a + b, 0) + 4, rowY + 9 + l * 5);
                  }
                }
                rowY += rowHeight;
                if (rowY > 270) { doc.addPage(); rowY = 20; }
              });
              y = rowY + 5;
            }
          }
        });
      }

      // --- Notes du médecin ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(34, 197, 94);
      doc.text("Notes du médecin", margin, y);
      y += 7;
      doc.setDrawColor(200, 230, 201);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      if (notesData.notes && notesData.notes.length > 0) {
        notesData.notes.forEach((n: any, i: number) => {
          const noteText = `- ${n.note} (${new Date(n.date).toLocaleString("fr-FR")})`;
          const split = doc.splitTextToSize(noteText, pageWidth - 2 * margin - 8);
          doc.text(split, margin + 3, y);
          y += split.length * 6;
          if (y > 270) { doc.addPage(); y = 20; }
        });
      } else {
        doc.text("Aucune note enregistrée.", margin + 3, y); y += 7;
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
      const fileName = `rapport_${prediction.patient_nom || "patient"}_${prediction.id}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      alert("Erreur lors de la génération du rapport PDF.");
    }
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-green-100 via-white to-blue-50 flex flex-col text-gray-800">
      {/* Header identique à Patient, sticky en haut */}
      <div className="w-full fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-4 bg-gradient-to-r from-green-200 via-white to-blue-200 shadow-md">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-400 shadow">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <rect x="9" y="2" width="6" height="20" rx="3" fill="#38bdf8" />
              <rect x="2" y="9" width="20" height="6" rx="3" fill="#22c55e" />
            </svg>
          </span>
          <span className="text-2xl font-bold text-green-800 tracking-wide">
            DermaScan AI
          </span>
        </div>
        <div className="relative">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 font-semibold shadow transition md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
          >
            <Menu size={24} />
          </button>
          <div className="hidden md:flex items-center gap-4">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 font-semibold shadow transition"
              onClick={fetchHistory}
              title="Voir l'historique"
            >
              <History size={20} /> Historique
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold shadow transition"
              onClick={handleProfile}
              title="Profil"
            >
              <User size={20} /> Profil
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 font-semibold shadow transition"
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
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-green-100 flex flex-col z-50 animate-fade-in-fast">
              <button
                className="flex items-center gap-2 px-4 py-3 hover:bg-green-50 text-green-700 font-semibold rounded-t-xl"
                onClick={() => { setMenuOpen(false); fetchHistory(); }}
              >
                <History size={20} /> Historique
              </button>
              <button
                className="flex items-center gap-2 px-4 py-3 hover:bg-blue-50 text-blue-700 font-semibold"
                onClick={() => { setMenuOpen(false); handleProfile(); }}
              >
                <User size={20} /> Profil
              </button>
              <button
                className="flex items-center gap-2 px-4 py-3 hover:bg-green-50 text-green-700 font-semibold"
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
      {/* Décale le contenu pour ne pas passer sous le header */}
      <div className="pt-24 flex flex-col flex-1">
        {/* Zone principale avec mêmes dimensions que Patient */}
        <div className="flex-grow flex flex-col w-full max-w-5xl mx-auto">
          {/* Message de bienvenue juste avant le titre */}
          <div className="w-full flex justify-center mb-4">
            <div className="bg-blue-200/60 px-8 py-4 rounded-2xl shadow text-2xl font-bold text-blue-800 tracking-wide">
              {(() => {
                try {
                  const payload = JSON.parse(atob(token.split(".")[1]));
                  if (payload.prenom) return `Bienvenue, Dr. ${payload.prenom} !`;
                  if (payload.nom) return `Bienvenue, Dr. ${payload.nom} !`;
                  return "Bienvenue, Dr. !";
                } catch {
                  return "Bienvenue, Dr. !";
                }
              })()}
            </div>
          </div>
          {/* Formulaire d'informations patient à saisir par le médecin */}
          <div className="w-full flex justify-center mb-6">
            <form
              className="bg-green-50 border border-green-200 rounded-xl px-6 py-6 shadow flex flex-col gap-4 w-full max-w-2xl animate-fade-in"
              autoComplete="off"
              onSubmit={handlePatientFormSubmit}
            >
              <h3 className="text-xl font-bold text-green-800 mb-2 text-center">
                Informations du patient
              </h3>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex flex-col">
                  <label htmlFor="nom" className="font-semibold text-green-900 mb-1">Nom <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="nom"
                    id="nom"
                    placeholder="Nom"
                    value={patientForm.nom}
                    onChange={handlePatientFormChange}
                    className={`border ${patientFormTouched.nom && !patientForm.nom ? "border-red-400" : "border-green-200"} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-gray-800`}
                    autoComplete="off"
                    style={{ background: "#f8fafc", color: "#222" }}
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label htmlFor="prenom" className="font-semibold text-green-900 mb-1">Prénom <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="prenom"
                    id="prenom"
                    placeholder="Prénom"
                    value={patientForm.prenom}
                    onChange={handlePatientFormChange}
                    className={`border ${patientFormTouched.prenom && !patientForm.prenom ? "border-red-400" : "border-green-200"} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-gray-800`}
                    autoComplete="off"
                    style={{ background: "#f8fafc", color: "#222" }}
                  />
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex flex-col">
                  <label htmlFor="telephone" className="font-semibold text-green-900 mb-1">Téléphone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    name="telephone"
                    id="telephone"
                    placeholder="Numéro de téléphone"
                    value={patientForm.telephone}
                    onChange={handlePatientFormChange}
                    className={`border ${patientFormTouched.telephone && (!patientForm.telephone || !/^\d{10,15}$/.test(patientForm.telephone)) ? "border-red-400" : "border-green-200"} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-gray-800`}
                    autoComplete="off"
                    style={{ background: "#f8fafc", color: "#222" }}
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label htmlFor="sexe" className="font-semibold text-green-900 mb-1">Sexe <span className="text-red-500">*</span></label>
                  <select
                    name="sexe"
                    id="sexe"
                    value={patientForm.sexe}
                    onChange={handlePatientFormChange}
                    className={`border ${patientFormTouched.sexe && !patientForm.sexe ? "border-red-400" : "border-green-200"} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-gray-800`}
                    style={{ background: "#f8fafc", color: "#222" }}
                  >
                    <option value="">Sélectionner</option>
                    <option value="Homme">Homme</option>
                    <option value="Femme">Femme</option>
                  </select>
                </div>
                <div className="flex-1 flex flex-col">
                  <label htmlFor="age" className="font-semibold text-green-900 mb-1">Âge <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="age"
                    id="age"
                    placeholder="Âge"
                    value={patientForm.age}
                    onChange={handlePatientFormChange}
                    className={`border ${patientFormTouched.age && (!patientForm.age || isNaN(Number(patientForm.age)) || Number(patientForm.age) <= 0) ? "border-red-400" : "border-green-200"} rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-gray-800`}
                    min={0}
                    autoComplete="off"
                    style={{ background: "#f8fafc", color: "#222" }}
                  />
                </div>
              </div>
              {patientFormError && (
                <div className="text-red-600 font-semibold mt-2">{patientFormError}</div>
              )}
              {patientFormSaved && (
                <div className="text-green-700 font-semibold mt-2 animate-fade-in-fast">
                  Informations patient enregistrées !
                </div>
              )}
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold shadow hover:from-green-500 hover:to-blue-600 transition disabled:opacity-50"
                  disabled={!!validatePatientForm()}
                >
                  Enregistrer les informations
                </button>
              </div>
            </form>
          </div>
          <div className="w-full bg-white rounded-3xl shadow-2xl p-10 border border-green-100 mt-2 relative flex flex-col items-center">
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
              <div className="w-full bg-green-50 border border-green-300 rounded-3xl p-8 shadow-md animate-fade-in-fast flex flex-col items-start space-y-4 overflow-x-auto">
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
                {/* Top 3 classes dynamiques */}
                {Array.isArray(result.top_predictions) && (
                  <div className="mt-4 w-full">
                    <h4 className="text-lg font-bold text-blue-700 mb-2">Top 3 classes les plus probables :</h4>
                    <div className="flex flex-col md:flex-row gap-4">
                      {result.top_predictions.map((pred: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex-1 rounded-2xl border-2 ${
                            idx === 0
                              ? "border-blue-400 bg-blue-50"
                              : idx === 1
                              ? "border-green-300 bg-green-50"
                              : "border-gray-200 bg-gray-50"
                          } p-4 shadow transition hover:scale-105 hover:shadow-lg cursor-pointer`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-blue-700 text-base">{cleanDiseaseName(pred.class_name)}</span>
                            <span className="text-green-700 font-mono text-sm">
                              ({(pred.confidence <= 1 ? (pred.confidence * 100).toFixed(2) : pred.confidence.toFixed(2))}%)
                            </span>
                          </div>
                          {/* Affiche description courte si dispo */}
                          <CompareDiseaseShortInfo diseaseName={cleanDiseaseName(pred.class_name)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Fiche de comparaison dynamique */}
                {Array.isArray(result.top_predictions) && result.top_predictions.length >= 2 && (
                  <div className="mt-8 w-full">
                    <h4 className="text-lg font-bold text-blue-700 mb-4">Fiche de comparaison entre maladies proches</h4>
                    <CompareDiseaseTable diseases={result.top_predictions.map((p: any) => p.class_name)} />
                  </div>
                )}
                {/* Affiche un tableau de comparaison des profils médicaux standards pour les 3 maladies prédictes */}
                {Array.isArray(result.top_predictions) && result.top_predictions.length >= 2 && (
                  <DiseaseProfilesComparison diseases={result.top_predictions.map((p: any) => p.class_name)} />
                )}
              </div>
            )}
            {result?.prediction_id && (
              <MedecinNotesZone predictionId={result.prediction_id} token={token} />
            )}
          </div>
        </div>
        {/* Historique des prédictions : liste déroulante (drawer) à droite */}
        {showHistory && (
          <div
            className="fixed inset-0 z-50 flex justify-end items-stretch bg-black/30 animate-fade-in-fast"
            onClick={() => { setShowHistory(false); setSelectedHistory(null); }}
          >
            {/* Drawer historique à droite */}
            <div
              className="relative h-full w-96 max-w-full bg-white shadow-2xl transition-all duration-500 ease-in-out rounded-l-3xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-green-100 bg-gradient-to-r from-green-100 via-white to-blue-100 rounded-tr-2xl">
                <h3 className="text-xl font-bold text-green-700 flex items-center gap-2">
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
                  // Fenêtre verticale, style zone de prédiction, animée et améliorée
                  <div
                    className="fixed right-0 left-0 top-1/2 z-50 mx-auto max-w-2xl w-full p-0"
                    style={{ transform: "translateY(-50%)", pointerEvents: "auto" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="bg-gradient-to-br from-green-50 via-white to-blue-50 border border-green-200 rounded-3xl shadow-2xl p-10 animate-slide-in-down relative flex flex-col items-center"
                      style={{
                        boxShadow: "0 8px 32px 0 rgba(34,197,94,0.12), 0 1.5px 8px 0 #bae6fd",
                        minHeight: 420,
                        maxHeight: "90vh",
                        overflowY: "auto"
                      }}
                    >
                      {/* Boutons retour et supprimer côte à côte en haut, bien espacés */}
                      <div className="w-full flex justify-between items-center mb-2">
                        <button
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold shadow transition text-base"
                          style={{ minHeight: 36, minWidth: 0, height: 36, padding: "0 14px", fontWeight: 600, fontSize: "1rem" }}
                          onClick={() => setSelectedHistory(null)}
                          title="Revenir à la liste"
                        >
                          <ArrowLeft size={18} />
                          Retour
                        </button>
                        <button
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold shadow transition text-base"
                          style={{ minHeight: 36, minWidth: 0, height: 36, padding: "0 14px", fontWeight: 600, fontSize: "1rem" }}
                          onClick={() => {
                            setPendingDeleteId(selectedHistory.id);
                            setShowDeleteModal(true);
                          }}
                          title="Supprimer cette prédiction"
                        >
                          <Trash2 size={18} />
                          Supprimer
                        </button>
                      </div>

                      {/* Le titre reste bien en dessous */}
                      <h2 className="text-2xl font-extrabold text-center text-blue-700 tracking-tight drop-shadow bg-blue-50 py-2 rounded-xl w-full mb-4 mt-2">
                        Détail de la prédiction
                      </h2>

                      {/* Image de la prédiction */}
                      <div className="w-full mb-6">
                        {selectedHistory.image_data ? (
                          <div className="relative w-full h-64 rounded-xl overflow-hidden shadow-lg">
                            <img 
                              src={`data:image/jpeg;base64,${selectedHistory.image_data}`}
                              alt="Image de la prédiction"
                              className="w-full h-full object-contain bg-white"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-64 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                            <div className="text-center">
                              <ImagePlus size={48} className="text-gray-400 mx-auto mb-2" />
                              <span className="text-gray-500">Image non disponible</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="w-full flex flex-col gap-2">
                        {/* Affiche infos patient en premier */}
                        <div className="mt-0 mb-4">
                          <div className="font-bold text-green-800 text-base mb-2 flex items-center gap-2">
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                              <rect x="9" y="2" width="6" height="20" rx="3" fill="#38bdf8" />
                              <rect x="2" y="9" width="20" height="6" rx="3" fill="#22c55e" />
                            </svg>
                            Informations du patient
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 bg-green-50 border border-green-200 rounded-xl p-4 shadow-inner">
                            <div>
                              <span className="text-gray-700 font-semibold">Nom :</span>{" "}
                              <span className="text-gray-900">{selectedHistory.patient_nom || <span className="text-gray-400">-</span>}</span>
                            </div>
                            <div>
                              <span className="text-gray-700 font-semibold">Prénom :</span>{" "}
                              <span className="text-gray-900">{selectedHistory.patient_prenom || <span className="text-gray-400">-</span>}</span>
                            </div>
                            <div>
                              <span className="text-gray-700 font-semibold">Téléphone :</span>{" "}
                              <span className="text-gray-900">{selectedHistory.telephone || <span className="text-gray-400">-</span>}</span>
                            </div>
                            <div>
                              <span className="text-gray-700 font-semibold">Sexe :</span>{" "}
                              <span className="text-gray-900">{selectedHistory.sexe || <span className="text-gray-400">-</span>}</span>
                            </div>
                            <div>
                              <span className="text-gray-700 font-semibold">Âge :</span>{" "}
                              <span className="text-gray-900">{selectedHistory.age || <span className="text-gray-400">-</span>}</span>
                            </div>
                          </div>
                        </div>
                        {/* Ensuite les infos prédiction */}
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Maladie prédite :</span>
                          <span className="text-green-700 font-bold">{cleanDiseaseName(selectedHistory.predicted_class)}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Date :</span>{" "}
                          <span>{selectedHistory.date}</span>
                        </div>
                        {/* Amélioration de l'affichage des infos patient */}
                        
                        {selectedHistory.confidence && (
                          <div>
                            <span className="font-semibold">Confiance :</span>{" "}
                            <span className="text-blue-700">{selectedHistory.confidence}</span>
                          </div>
                        )}
                        {selectedHistory.image_name && (
                          <div>
                            <span className="font-semibold">Image :</span>{" "}
                            <span className="text-gray-600 break-all">{selectedHistory.image_name}</span>
                          </div>
                        )}
                      </div>
                      {/* Top 3 classes */}
                      {Array.isArray(selectedHistory.top_predictions) && (
                        <div className="mt-6 w-full">
                          <h4 className="text-lg font-bold text-blue-700 mb-2">Top 3 classes les plus probables :</h4>
                          <div className="flex flex-col md:flex-row gap-4">
                            {selectedHistory.top_predictions.map((pred: any, idx: number) => (
                              <div
                                key={idx}
                                className={`flex-1 rounded-2xl border-2 ${
                                  idx === 0
                                    ? "border-blue-400 bg-blue-50"
                                    : idx === 1
                                    ? "border-green-300 bg-green-50"
                                    : "border-gray-200 bg-gray-50"
                                } p-4 shadow transition`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold text-blue-700 text-base">{cleanDiseaseName(pred.class_name)}</span>
                                  <span className="text-green-700 font-mono text-sm">
                                    ({(pred.confidence <= 1 ? (pred.confidence * 100).toFixed(2) : pred.confidence.toFixed(2))}%)
                                  </span>
                                </div>
                                <CompareDiseaseShortInfo diseaseName={cleanDiseaseName(pred.class_name)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Comparaison */}
                      {Array.isArray(selectedHistory.top_predictions) && selectedHistory.top_predictions.length >= 2 && (
                        <div className="mt-8 w-full">
                          <h4 className="text-lg font-bold text-blue-700 mb-4">Fiche de comparaison entre maladies proches</h4>
                          <DiseaseProfilesComparison diseases={selectedHistory.top_predictions.map((p: any) => p.class_name)} />
                        </div>
                      )}
                      {/* Notes : zone d'édition directe pour le médecin */}
                      {selectedHistory?.id && (
                        <div className="mt-6 w-full">
                          <h4 className="text-lg font-bold text-green-700 mb-4">
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="inline-block">
                              <rect x="9" y="2" width="6" height="20" rx="3" fill="#38bdf8" />
                              <rect x="2" y="9" width="20" height="6" rx="3" fill="#22c55e" />
                            </svg>
                            Notes du médecin
                          </h4>
                          {/* Permet d'ajouter/modifier les notes directement depuis l'historique */}
                          <MedecinNotesZone predictionId={selectedHistory.id} token={token} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {history.map((h) => {
                      // Affiche nom/prénom si présents et non vides, sinon fallback
                      const displayName =
                        (h.patient_prenom?.trim() || h.patient_nom?.trim())
                          ? `${h.patient_prenom?.trim() || ""} ${h.patient_nom?.trim() || ""}`.trim()
                          : `Prédiction #${h.id}`;
                      // Supprime infosPatient de la liste (on ne les affiche plus ici)
                      return (
                        <li key={h.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-green-50 rounded transition group">
                          <div
                            className="flex flex-col cursor-pointer flex-1"
                            onClick={() => setSelectedHistory(h)}
                          >
                            <span className="font-semibold text-green-700">
                              {displayName}
                            </span>
                            {/* Supprimé : infos patient dans la liste */}
                            <span className="text-sm text-gray-500">{h.date}</span>
                            {h.confidence && (
                              <span className="text-xs text-blue-700">
                                Confiance : {h.confidence}
                              </span>
                            )}
                            {h.image_name && (
                              <span
                                className="text-xs text-gray-400 break-all max-w-full"
                                style={{
                                  wordBreak: "break-all",
                                  whiteSpace: "pre-line",
                                  overflowWrap: "break-word",
                                  display: "block"
                                }}
                              >
                                Image : {h.image_name}
                              </span>
                            )}
                          </div>
                          {/* Bouton suppression sur une nouvelle ligne en mobile, à droite en desktop */}
                          <div className="flex sm:block mt-2 sm:mt-0">
                            <button
                              className="ml-0 sm:ml-2 flex items-center gap-1 px-2 py-1 rounded bg-red-50 hover:bg-red-200 text-red-600 text-xs font-bold shadow transition"
                              onClick={e => {
                                e.stopPropagation();
                                setPendingDeleteId(h.id);
                                setShowDeleteModal(true);
                              }}
                              title="Supprimer cette prédiction"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button
                              className="ml-2 flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-200 text-blue-600 text-xs font-bold shadow transition"
                              onClick={e => {
                                e.stopPropagation();
                                handleDownloadReport(h);
                              }}
                              title="Télécharger le rapport"
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Profile modal - version médecin */}
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
        `}
      </style>
      {/* Modal pour ajouter une note */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Ajouter une note</h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full h-32 p-2 border rounded mb-4"
              placeholder="Entrez votre note ici..."
            />
            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteText("");
                  setSelectedPredictionId(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitNote}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-sm w-full flex flex-col items-center">
            <h3 className="text-xl font-bold text-red-600 mb-4">Confirmation</h3>
            <p className="text-gray-700 mb-6 text-center">
              Êtes-vous sûr de vouloir supprimer cette prédiction&nbsp;? Cette action est irréversible.
            </p>
            <div className="flex gap-4">
              <button
                className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold"
                onClick={() => { setShowDeleteModal(false); setPendingDeleteId(null); }}
              >
                Annuler
              </button>
              <button
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
                onClick={async () => {
                  if (pendingDeleteId !== null) {
                    await handleDeleteHistory(pendingDeleteId);
                    setShowDeleteModal(false);
                    setPendingDeleteId(null);
                  }
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Affiche une description courte pour chaque maladie (si dispo dans le JSON)
function CompareDiseaseShortInfo({ diseaseName }: { diseaseName: string }) {
  const [desc, setDesc] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/disease_advice.json")
      .then(res => res.json())
      .then(json => {
        // Recherche par nom partiel (ex: "Eczema" dans "1. Eczema 1677")
        const key = Object.keys(json).find(k => diseaseName.includes(k));
        if (key && json[key]?.description) setDesc(json[key].description);
        else setDesc(null);
      })
      .catch(() => setDesc(null));
  }, [diseaseName]);

  if (!desc) return null;
  return (
    <div className="text-xs text-gray-600 mt-1">
      {desc}
    </div>
  );
}

// Fiche de comparaison dynamique entre maladies proches (utilise comparisons.json)
// Affiche toutes les comparaisons possibles entre les maladies détectées (top_predictions)
function CompareDiseaseTable({ diseases }: { diseases: string[] }) {
  const [compareData, setCompareData] = React.useState<any>(null);

  React.useEffect(() => {
    fetch("/comparisons.json")
      .then(res => res.json())
      .then(json => setCompareData(json))
      .catch(() => setCompareData(null));
  }, [diseases]);

  // Génère toutes les paires possibles de maladies à comparer
  function getAllPairs(arr: string[]): [string, string][] {
    const pairs: [string, string][] = [];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        pairs.push([arr[i], arr[j]]);
      }
    }
    return pairs;
  }

  // Extrait le nom court pour matcher la clé JSON (ex: "Eczema" dans "1. Eczema 1677")
  function getSimpleName(d: string) {
    // Prend le mot principal (après le numéro et le point)
    const parts = d.split(/[ .-]/).filter(Boolean);
    if (parts.length > 1) {
      // Pour "1. Eczema 1677" => "eczema"
      return parts[1].toLowerCase().replace(/[^a-z]/gi, "");
    }
    return d.toLowerCase().replace(/[^a-z]/gi, "");
  }

  if (!compareData) return null;

  const pairs = getAllPairs(diseases);

  // Pour chaque paire, trouve la clé de comparaison correspondante
  const comparisonBlocks = pairs.map(([d1, d2], idx) => {
    const s1 = getSimpleName(d1);
    const s2 = getSimpleName(d2);
    // Cherche une clé qui contient exactement les deux maladies (ordre indifférent)
    const key = Object.keys(compareData).find(k => {
      // On normalise la clé du JSON pour matcher les deux maladies
      const keyNorm = k
        .toLowerCase()
        .replace(/[^a-z_]/g, "")
        .split("_vs_")
        .sort()
        .join("_vs_");
      const pairNorm = [s1, s2].sort().join("_vs_");
      return keyNorm === pairNorm;
    });
    if (!key) return null;
    const criteres = compareData[key]?.["critères"];
    if (!criteres || criteres.length < 1) return null;

    // Pour chaque maladie, trouve la colonne correspondante dans le JSON
    function colKey(d: string) {
      // Essaie le nom court, puis le nom complet
      const simple = getSimpleName(d);
      // Cherche la clé qui matche dans le critère
      return (crit: any) =>
        crit[simple] !== undefined
          ? crit[simple]
          : crit[d.toLowerCase()] !== undefined
          ? crit[d.toLowerCase()]
          : "-";
    }

    return (
      <div key={key} className="mb-8">
        <h5 className="text-base font-bold text-blue-700 mb-2">
          Comparaison : {d1} / {d2}
        </h5>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-blue-200 rounded-xl bg-white shadow">
            <thead>
              <tr>
                <th className="px-4 py-2 border-b bg-blue-50">Critère</th>
                <th className="px-4 py-2 border-b text-blue-700 font-bold">{d1}</th>
                <th className="px-4 py-2 border-b text-blue-700 font-bold">{d2}</th>
              </tr>
            </thead>
            <tbody>
              {criteres.map((crit: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 font-semibold bg-blue-50">{crit.nom}</td>
                  <td className="px-4 py-2 align-top">{colKey(d1)(crit)}</td>
                  <td className="px-4 py-2 align-top">{colKey(d2)(crit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  });

  return (
    <div>
      {comparisonBlocks.filter(Boolean).length > 0 ? (
        comparisonBlocks
      ) : (
        <div className="text-gray-500 italic">Aucune comparaison disponible pour ces maladies.</div>
      )}
    </div>
  );
}

// Fonction utilitaire pour comparer deux maladies à partir du JSON
function ComparisonTable({ diseaseA, diseaseB }: { diseaseA: string; diseaseB: string }) {
  const [compareData, setCompareData] = React.useState<any>(null);

  React.useEffect(() => {
    fetch("/comparisons.json")
      .then(res => res.json())
      .then(json => setCompareData(json))
      .catch(() => setCompareData(null));
  }, [diseaseA, diseaseB]);

  // Extrait le nom court pour matcher la clé JSON (ex: "Eczema" dans "1. Eczema 1677")
  function getSimpleName(d: string) {
    const parts = d.split(/[ .-]/).filter(Boolean);
    if (parts.length > 1) {
      return parts[1].toLowerCase().replace(/[^a-z]/gi, "");
    }
    return d.toLowerCase().replace(/[^a-z]/gi, "");
  }

  if (!compareData) return null;

  const sA = getSimpleName(diseaseA);
  const sB = getSimpleName(diseaseB);

  // Cherche la clé de comparaison qui contient les deux maladies (ordre indifférent)
  const key = Object.keys(compareData).find(
    k =>
      (k.toLowerCase().includes(sA) && k.toLowerCase().includes(sB)) ||
      (k.toLowerCase().includes(sB) && k.toLowerCase().includes(sA))
  );
  if (!key) return null;

  const criteres = compareData[key]?.["critères"];
  if (!criteres || criteres.length < 1) return null;

  // Pour chaque maladie, trouve la colonne correspondante dans le JSON
  function colKey(d: string) {
    const simple = getSimpleName(d);
    return (crit: any) =>
      crit[simple] !== undefined
        ? crit[simple]
        : crit[d.toLowerCase()] !== undefined
        ? crit[d.toLowerCase()]
        : "-";
  }

  return (
    <div className="overflow-x-auto my-6">
      <h5 className="text-base font-bold text-blue-700 mb-2">
        Comparaison : {diseaseA} / {diseaseB}
      </h5>
      <table className="min-w-full border border-blue-200 rounded-xl bg-white shadow">
        <thead>
          <tr>
            <th className="px-4 py-2 border-b bg-blue-50">Critère</th>
            <th className="px-4 py-2 border-b text-blue-700 font-bold">{diseaseA}</th>
            <th className="px-4 py-2 border-b text-blue-700 font-bold">{diseaseB}</th>
          </tr>
        </thead>
        <tbody>
          {criteres.map((crit: any, i: number) => (
            <tr key={i} className="border-t">
              <td className="px-4 py-2 font-semibold bg-blue-50">{crit.nom}</td>
              <td className="px-4 py-2 align-top">{colKey(diseaseA)(crit)}</td>
              <td className="px-4 py-2 align-top">{colKey(diseaseB)(crit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Affiche un tableau de comparaison des profils médicaux standards pour les 3 maladies prédictes
function DiseaseProfilesComparison({ diseases }: { diseases: string[] }) {
  const [profiles, setProfiles] = React.useState<any>({});

  React.useEffect(() => {
    fetch("/disease_profiles.json")
      .then(res => res.json())
      .then(json => setProfiles(json))
      .catch(() => setProfiles({}));
  }, [diseases]);

  // Fonction robuste pour matcher une maladie prédite à une clé du JSON
  function findProfileKey(disease: string) {
    // Nettoie le nom : retire numéro, tiret, nombre, parenthèses, etc.
    let mainName = disease
      .replace(/^\d+\.\s*/, "") // retire "8. "
      .replace(/-\s*\d+(\.\d+)?[kK]?/, "") // retire "- 1.8k" ou "- 2103"
      .replace(/\([^)]+\)/g, "") // retire parenthèses éventuelles
      .replace(/[^a-zA-Z\s]/g, "") // retire caractères spéciaux
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    // Essaie de trouver la clé la plus proche (tous les mots significatifs présents)
    const diseaseWords = mainName.split(" ").filter((w: string) => w.length > 2);
    // Recherche stricte : tous les mots doivent être présents dans la clé
    let bestKey = Object.keys(profiles).find((key: string) => {
      const keyLow = key.toLowerCase();
      return diseaseWords.every((word: string) => keyLow.includes(word));
    });
    // Si rien trouvé, essaie un match plus souple (au moins 1 mot significatif)
    if (!bestKey && diseaseWords.length > 0) {
      bestKey = Object.keys(profiles).find((key: string) => {
        const keyLow = key.toLowerCase();
        return diseaseWords.some((word: string) => keyLow.includes(word));
      });
    }
    // Si toujours rien, essaie un match partiel sur le début du nom
    if (!bestKey) {
      bestKey = Object.keys(profiles).find(key =>
        key.toLowerCase().startsWith(mainName.split(" ")[0])
      );
    }
    return bestKey;
  }

  const selectedProfiles = diseases
    .map((d) => {
      const key = findProfileKey(d);
      return key ? { name: key, data: profiles[key] } : null;
    })
    .filter(Boolean);

  if (selectedProfiles.length < 2) {
    return (
      <div className="text-gray-500 italic my-8">
        Pas de fiche de comparaison clinique disponible pour ces maladies.
      </div>
    );
  }

  const allKeys = selectedProfiles.map((p: any) => p ? Object.keys(p.data) : []);
  const commonKeys = allKeys.reduce((a: string[], b: string[]) => a.filter((k: string) => b.includes(k)), allKeys[0] || []);

  if (commonKeys.length === 0) {
    return (
      <div className="text-gray-500 italic my-8">
        Pas de fiche de comparaison clinique disponible pour ces maladies.
      </div>
    );
  }

  // Palette de couleurs pour colonnes
  const colColors = [
    "bg-gradient-to-br from-blue-50 to-blue-100",
    "bg-gradient-to-br from-green-50 to-green-100",
    "bg-gradient-to-br from-yellow-50 to-yellow-100"
  ];

  return (
    <div className="overflow-x-auto my-8">
      <table className="min-w-full border-separate border-spacing-0 rounded-xl shadow-xl bg-white">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 px-4 py-3 border-b-2 border-blue-200 bg-blue-100 text-left font-bold text-blue-700 shadow">
              Critère
            </th>
            {selectedProfiles.map((p, idx) => (
              <th
                key={idx}
                className={`px-4 py-3 border-b-2 border-blue-200 text-center font-bold text-blue-700 shadow ${colColors[idx % colColors.length]}`}
              >
                <span className="inline-flex items-center gap-2">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" className="inline-block">
                    <circle cx="12" cy="12" r="9" fill={["#38bdf8", "#22c55e", "#eab308"][idx % 3]} />
                  </svg>
                  {p.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {commonKeys.map((crit, i) => (
            <tr key={i} className="border-t hover:bg-blue-50/40 transition">
              <td className="sticky left-0 z-10 px-4 py-3 font-semibold bg-blue-50 border-r border-blue-100 shadow text-blue-800 min-w-[160px]">
                {crit}
              </td>
              {selectedProfiles.map((p, idx) => (
                <td
                  key={idx}
                  className={`px-4 py-3 align-top border-r border-blue-100 text-gray-700 text-sm ${colColors[idx % colColors.length]} transition`}
                  style={{
                    borderLeft: idx === 0 ? "none" : undefined,
                    borderRight: idx === selectedProfiles.length - 1 ? "none" : undefined,
                    fontWeight: p.data[crit]?.length > 60 ? 400 : 600,
                  }}
                >
                  {p.data[crit] || <span className="text-gray-400">-</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <style>
        {`
          .min-w-full th, .min-w-full td {
            border-bottom: 1px solid #e0e7ef;
          }
          .min-w-full th {
            background: linear-gradient(90deg, #f0f9ff 0%, #e0f2fe 100%);
          }
        `}
      </style>
    </div>
  );
}

// Ajoute la zone de saisie et l'affichage des notes du médecin sous le résultat principal
function MedecinNotesZone({ predictionId, token }: { predictionId: number, token: string }) {
  const [notes, setNotes] = React.useState<{ note: string; date: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [noteInput, setNoteInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [editValue, setEditValue] = React.useState<string>("");

  // Récupère toutes les notes à chaque changement de predictionId
  const fetchNotes = React.useCallback(() => {
    if (!predictionId) return;
    setLoading(true);
    fetch(`http://localhost:8000/prediction/${predictionId}/notes`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) throw new Error("Erreur lors de la récupération des notes");
        const data = await res.json();
        if (data && Array.isArray(data.notes)) setNotes(data.notes);
        else setNotes([]);
      })
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [predictionId, token]);

  React.useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Ajoute une note (et recharge la liste après ajout)
  const handleAddNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!noteInput.trim()) {
      setError("Le commentaire ne peut pas être vide.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8000/prediction/${predictionId}/note`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note: noteInput })
      });
      if (!res.ok) throw new Error("Erreur lors de l'enregistrement de la note");
      setNoteInput("");
      fetchNotes();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'enregistrement");
    }
    setSubmitting(false);
  };

  // Supprimer une note
  const handleDeleteNote = async (index: number) => {
    if (!window.confirm("Supprimer cette note ?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8000/prediction/${predictionId}/note/${index}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      fetchNotes();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la suppression");
    }
    setSubmitting(false);
  };

  // Modifier une note
  const handleEditNote = (index: number) => {
    setEditIndex(index);
    setEditValue(notes[index].note);
  };

  const handleSaveEdit = async (index: number) => {
    if (!editValue.trim()) {
      setError("Le commentaire ne peut pas être vide.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8000/prediction/${predictionId}/note/${index}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note: editValue })
      });
      if (!res.ok) throw new Error("Erreur lors de la modification");
      setEditIndex(null);
      setEditValue("");
      fetchNotes();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la modification");
    }
    setSubmitting(false);
  };

  if (!predictionId) return null;

  return (
    <div className="w-full mt-8 bg-gradient-to-br from-green-50 via-white to-blue-50 border border-green-200 rounded-2xl shadow p-6">
      <h4 className="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" className="inline-block animate-pulse">
          <rect x="9" y="2" width="6" height="20" rx="3" fill="#38bdf8" />
          <rect x="2" y="9" width="20" height="6" rx="3" fill="#22c55e" />
        </svg>
        Notes du médecin
      </h4>
      <form 
        onSubmit={handleAddNote} 
        className="flex flex-col md:flex-row gap-4 mb-4 items-stretch"
        style={{
          background: "linear-gradient(90deg, #e0f7fa 0%, #f0fff4 100%)",
          borderRadius: "1rem",
          padding: "1rem",
          border: "1.5px solid #bae6fd",
          boxShadow: "0 2px 12px 0 #e0f2fe"
        }}
      >
        <textarea
          className="flex-1 border-2 border-blue-200 bg-blue-50 rounded-xl p-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none min-h-[60px] shadow-md font-mono text-base transition-all placeholder:text-blue-300"
          placeholder="Écrivez ici vos observations ou recommandations médicales... (Ctrl+Entrée pour valider)"
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          disabled={submitting}
          maxLength={500}
          style={{
            background: "linear-gradient(90deg, #e0f2fe 0%, #f0fff4 100%)",
            borderLeft: "6px solid #22c55e",
            borderRight: "6px solid #38bdf8",
            fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif"
          }}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleAddNote(e);
          }}
        />
        <button
          type="submit"
          className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold shadow bg-gradient-to-r from-green-400 to-blue-500 text-white hover:from-green-500 hover:to-blue-600 transition disabled:opacity-50 ${submitting ? "cursor-not-allowed" : ""}`}
          disabled={submitting || !noteInput.trim()}
          style={{
            fontSize: "1.15rem",
            minWidth: "160px",
            border: "none",
            boxShadow: "0 2px 8px 0 #e0e7ef"
          }}
        >
          {submitting ? "Enregistrement..." : (
            <>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                <rect x="9" y="2" width="6" height="20" rx="3" fill="#38bdf8" />
                <rect x="2" y="9" width="20" height="6" rx="3" fill="#22c55e" />
              </svg>
              Enregistrer
            </>
          )}
        </button>
      </form>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {loading ? (
          <div className="text-gray-400 italic">Chargement des notes...</div>
        ) : notes && notes.length === 0 ? (
          <div className="text-gray-500 italic">Aucune note enregistrée pour ce diagnostic.</div>
        ) : (
          <ul className="space-y-3">
            {notes.map((n, idx) => (
              <li
                key={idx}
                className="bg-gradient-to-r from-green-100 to-blue-100 border-l-4 border-blue-400 rounded-lg p-4 shadow flex flex-col relative overflow-hidden group"
                style={{
                  animation: "fade-in 0.7s cubic-bezier(.4,2,.6,1)",
                  transition: "box-shadow 0.2s"
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-700 font-bold flex items-center gap-1">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" className="inline-block">
                      <rect x="9" y="2" width="6" height="20" rx="3" fill="#38bdf8" />
                      <rect x="2" y="9" width="20" height="6" rx="3" fill="#22c55e" />
                    </svg>
                    Note {notes.length - idx}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(n.date).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short"
                    })}
                  </span>
                </div>
                {editIndex === idx ? (
                  <div className="flex flex-col gap-2 mt-2 animate-fade-in-fast">
                    <textarea
                      className="border-2 border-blue-300 rounded-lg p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none bg-white"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      maxLength={500}
                      rows={2}
                      style={{ fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif" }}
                    />
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-1 rounded bg-green-500 text-white font-bold hover:bg-green-600 transition flex items-center gap-1"
                        onClick={() => handleSaveEdit(idx)}
                        disabled={submitting}
                        type="button"
                      >
                        <Check size={16} /> Sauver
                      </button>
                      <button
                        className="px-4 py-1 rounded bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 transition flex items-center gap-1"
                        onClick={() => { setEditIndex(null); setEditValue(""); }}
                        type="button"
                      >
                        <Close size={16} /> Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-800 mt-1 whitespace-pre-line font-semibold animate-fade-in">
                    {n.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(20px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .animate-fade-in { animation: fade-in 0.7s cubic-bezier(.4,2,.6,1); }
          .animate-fade-in-fast { animation: fade-in 0.3s cubic-bezier(.4,2,.6,1); }
        `}
      </style>
    </div>
  );
}

// Affiche les notes en lecture seule
function ReadOnlyNotes({ predictionId, token }: { predictionId: number, token: string }) {
  const [notes, setNotes] = React.useState<{ note: string; date: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!predictionId) return;
    setLoading(true);
    fetch(`http://localhost:8000/prediction/${predictionId}/notes`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) throw new Error("Erreur lors de la récupération des notes");
        const data = await res.json();
        if (data && Array.isArray(data.notes)) setNotes(data.notes);
        else setNotes([]);
      })
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [predictionId, token]);

  return (
    <div>
      {loading ? (
        <div className="text-gray-400 italic">Chargement des notes...</div>
      ) : notes && notes.length === 0 ? (
        <div className="text-gray-500 italic">Aucune note enregistrée pour ce diagnostic.</div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n, idx) => (
            <li
              key={idx}
              className="bg-gradient-to-r from-green-100 to-blue-100 border-l-4 border-blue-400 rounded-lg p-4 shadow flex flex-col relative overflow-hidden group"
              style={{
                animation: "fade-in 0.7s cubic-bezier(.4,2,.6,1)",
                transition: "box-shadow 0.2s"
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-green-700 font-bold flex items-center gap-1">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" className="inline-block">
                    <rect x="9" y="2" width="6" height="20" rx="3" fill="#38bdf8" />
                    <rect x="2" y="9" width="20" height="6" rx="3" fill="#22c55e" />
                  </svg>
                  Note {notes.length - idx}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  {new Date(n.date).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short"
                  })}
                </span>
              </div>
              <div className="text-gray-800 mt-1 whitespace-pre-line font-semibold animate-fade-in">
                {n.note}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

  // Thème médical bleu/vert (comme patient)
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
        <Close size={22} />
      </button>
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-300 via-green-200 to-blue-100 flex items-center justify-center shadow-lg mb-2 border-4 border-blue-200">
          <User size={48} className="text-blue-700" />
        </div>
        <h3 className="text-3xl font-extrabold text-blue-700 mb-1 tracking-tight">Mon profil</h3>
        <div className="text-blue-500 font-semibold text-base">Bienvenue sur votre espace professionnel</div>
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

export default Medecin;
