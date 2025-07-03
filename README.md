# 🧠 DermaScan AI

> Application de diagnostic assisté par l’intelligence artificielle pour la détection de maladies de peau à partir d’images.

---

## 📸 Présentation

**DermaScan AI** est une plateforme web intelligente permettant d’analyser une image cutanée et de prédire la pathologie parmi **11 maladies dermatologiques** à l’aide d’un modèle IA entraîné (DenseNet121).  
Elle propose un **résultat en temps réel**, un **rapport PDF téléchargeable**, et une interface intuitive.

---

## 🚀 Fonctionnalités

- 🔍 Prédiction de 11 maladies de peau via une image uploadée
- 🧠 Modèle DenseNet121 pré-entraîné (ImageNet) et affiné sur un dataset médical équilibré
- 📑 Génération automatique d’un rapport PDF avec résultats & probabilités
- 🧪 Visualisation de confiance du modèle
- 🔐 Authentification sécurisée (JWT + Bcrypt)

---

## 🛠️ Technologies utilisées

### 🔬 IA & Traitement d’image
- Python
- TensorFlow / Keras
- Scikit-learn
- NumPy, Pandas, Matplotlib

### 🌐 Web (Fullstack)
- **Frontend** : React + TypeScript + Tailwind CSS
- **Backend** : FastAPI (Python)
- **Base de données** : MySQL

### 📦 Autres
- JWT pour l’authentification
- ReportLab / FPDF pour le PDF export
- Docker (optionnel pour déploiement)

---
### 📈 Résultats du modèle
| Modèle         | Accuracy     |
| -------------- | ------------ |
| DenseNet121    | **89.99%** ✅ |
| EfficientNetB3 | 89.49%       |
| VGG16          | 88.22%       |
---

![image](https://github.com/user-attachments/assets/5e568e5e-37be-4994-b9e2-5f1cd77ed94a)
![image](https://github.com/user-attachments/assets/11b6c8e0-3b55-41a9-b746-83b3ff7576be)


