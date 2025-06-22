from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from auth import router as auth_router, User, Prediction, get_db
from sqlalchemy.orm import Session
from sqlalchemy.ext.declarative import declarative_base
from jose import jwt
from fastapi import Header, Depends, HTTPException
from datetime import datetime
from PIL import Image
import numpy as np
import io
import tensorflow as tf
from fastapi import status
from sqlalchemy import Text, or_
from pydantic import BaseModel
from fastapi import Path
from sqlalchemy import Column, Integer, String
import base64
from pathlib import Path
import os
import uuid
from tensorflow.keras.applications.densenet import preprocess_input
import re

Base = declarative_base()

app = FastAPI()
import json
with open("disease_advice.json", "r", encoding="utf-8") as f:
    disease_advice = json.load(f)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*", "patient_nom", "patient_prenom"],  # <-- Ajoute explicitement ici si besoin
)
app.include_router(auth_router, tags=["auth"])
# Charge ton modèle ici (déjà fait)
model = tf.keras.models.load_model(r'D:\S2\projet\skin-app\backend\models\denseNet.keras')

# Dimensions attendues par le modèle (exemple 224x224, adapte si nécessaire)
IMG_SIZE = (256, 256)
class_names = ['1. Eczema 1677', '10. Warts Molluscum and other Viral Infections - 2103', '2. Melanoma 15.75k', '3. Atopic Dermatitis - 1.25k', '4. Basal Cell Carcinoma (BCC) 3323', '5. Melanocytic Nevi (NV) - 7970', '6. Benign Keratosis-like Lesions (BKL) 2624', '7. Psoriasis pictures Lichen Planus and related diseases - 2k', '8. Seborrheic Keratoses and other Benign Tumors - 1.8k', '9. Tinea Ringworm Candidiasis and other Fungal Infections - 1.7k', 'acne']

# !!! IMPORTANT !!!
# Utilise exactement la même clé secrète et le même algorithme que dans auth.py
SECRET_KEY = "TON_SECRET_KEY_SUPER_SECRET"  # Doit être identique à auth.py
ALGORITHM = "HS256"  # Doit être identique à auth.py


# 1. Ajoute les colonnes patient_nom et patient_prenom à Prediction (dans auth.py aussi)
# Dans auth.py, ajoute :
# patient_nom = Column(String, nullable=True)
# patient_prenom = Column(String, nullable=True)

# 2. Modifie la route /predict pour stocker nom/prenom si medecin
@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    authorization: str = Header(None),
    db: Session = Depends(get_db),
    patient_nom: str = Header(None, alias="patient_nom"),
    patient_prenom: str = Header(None, alias="patient_prenom"),
    patient_telephone: str = Header(None, alias="patient_telephone"),
    patient_sexe: str = Header(None, alias="patient_sexe"),
    patient_age: str = Header(None, alias="patient_age"),
):
    # Correction : accepte aussi "authorization" minuscule (certains navigateurs l'envoient ainsi)
    if not authorization:
        from fastapi import Request
        import inspect
        frame = inspect.currentframe()
        request = None
        while frame:
            if "request" in frame.f_locals:
                request = frame.f_locals["request"]
                break
            frame = frame.f_back
        if request:
            authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        print("Authorization header reçu:", authorization)
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        email = payload.get("sub")
        role = payload.get("role")
        user_nom = payload.get("nom")
        user_prenom = payload.get("prenom")
    except Exception as e:
        print("Erreur décodage JWT:", str(e))
        raise HTTPException(status_code=401, detail="Token invalide")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print("Utilisateur non trouvé pour email:", email)
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # Ajoute ce print pour vérifier la réception des headers
    print("DEBUG patient_nom:", patient_nom, "| patient_prenom:", patient_prenom, "| role:", role)
    try:
        image_data = await file.read()
        
        # Générer un nom unique pour l'image
        unique_filename = generate_unique_filename(file.filename)
        
        # S'assurer que le dossier uploads existe
        uploads_dir = ensure_uploads_dir()
        
        # Sauvegarder l'image dans le dossier uploads
        image_path = uploads_dir / unique_filename
        with open(image_path, "wb") as f:
            f.write(image_data)
        
        # Vérifier que l'image a bien été sauvegardée
        if not image_path.exists():
            raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde de l'image")
        
        image_pil = Image.open(io.BytesIO(image_data)).convert('RGB')
        image_resized = image_pil.resize(IMG_SIZE)
        img_array = np.array(image_resized)
        img_array = preprocess_input(img_array)
        input_tensor = np.expand_dims(img_array, axis=0)
        preds = model.predict(input_tensor)
        pred_class_index = int(np.argmax(preds))
        pred_class_name = clean_disease_name(class_names[pred_class_index])
        confidence = float(np.max(preds))

        # Obtenir les 3 classes les plus probables
        top_indices = preds[0].argsort()[-3:][::-1]
        top_predictions = [
            {
                "class_name": clean_disease_name(class_names[i]),
                "confidence": float(preds[0][i])
            } for i in top_indices
        ]

        # Générer la fiche de comparaison (pour l'historique)
        with open("disease_profiles.json", "r", encoding="utf-8") as f:
            comparisons_data = json.load(f)
        def get_simple_name(d):
            if not isinstance(d, str):
                return ""
            parts = d.split(".")
            if len(parts) > 1:
                rest = parts[1].strip()
                main = rest.split(" ")[0]
                return main.lower()
            return d.lower()
        comparison_pairs = []
        for i in range(len(top_predictions)):
            for j in range(i + 1, len(top_predictions)):
                d1 = top_predictions[i]["class_name"]
                d2 = top_predictions[j]["class_name"]
                s1 = get_simple_name(d1)
                s2 = get_simple_name(d2)
                found_key = None
                for k in comparisons_data.keys():
                    if s1 in k.lower() and s2 in k.lower():
                        found_key = k
                        break
                if found_key:
                    crits = []
                    profile1 = comparisons_data[found_key]
                    profile2 = comparisons_data[found_key]
                    if isinstance(profile1, dict) and isinstance(profile2, dict):
                        common_keys = set(profile1.keys()) & set(profile2.keys())
                        for key in common_keys:
                            crits.append({
                                "nom": key,
                                d1: profile1.get(key, "-"),
                                d2: profile2.get(key, "-")
                            })
                    comparison = {
                        "diseases": [d1, d2],
                        "criteria": crits
                    }
                    comparison_pairs.append(comparison)
    except Exception as e:
        print("Erreur prédiction :", str(e))
        raise HTTPException(status_code=500, detail=f"Erreur prédiction : {str(e)}")

    try:
        # ...existing code...
        if role == "medecin":
            pred_patient_nom = patient_nom
            pred_patient_prenom = patient_prenom
        else:
            pred_patient_nom = user_nom
            pred_patient_prenom = user_prenom

        print("DEBUG pred_patient_nom:", pred_patient_nom, "| pred_patient_prenom:", pred_patient_prenom)

        # Assure que top_predictions et comparison_pairs existent ici
        new_pred = Prediction(
            user_id=user.id,
            image_name=unique_filename,
            predicted_class=pred_class_name,
            confidence=str(confidence),
            date=datetime.utcnow().isoformat(),
            notes=None,
            top_predictions=json.dumps(top_predictions),
            comparison=json.dumps(comparison_pairs) if comparison_pairs else None,
            patient_nom=pred_patient_nom,
            patient_prenom=pred_patient_prenom,
            telephone=patient_telephone,
            sexe=patient_sexe,
            age=patient_age
        )
        db.add(new_pred)
        db.commit()
        db.refresh(new_pred)
    except Exception as e:
        print("Erreur sauvegarde historique :", str(e))
        raise HTTPException(status_code=500, detail=f"Erreur sauvegarde historique : {str(e)}")

    advice = None
    try:
        simple_name = pred_class_name.split(".")[1].strip().split(" ")[0]
        print("Maladie prédite:", pred_class_name, "| Clef utilisée pour advice:", simple_name)
        advice = disease_advice.get(simple_name)
    except Exception as e:
        print("Erreur extraction conseil :", str(e))
        advice = None

    # Ajoute ce print pour vérifier la réponse
    print("DEBUG API RESPONSE:", {
        "predicted_class_index": int(pred_class_index),
        "predicted_class_name": pred_class_name,
        "confidence": confidence,
        "top_predictions": top_predictions,
        "advice": advice,
        "prediction_id": new_pred.id,
        "comparison": comparison_pairs
    })

    return JSONResponse(content={
        "predicted_class_index": int(pred_class_index),
        "predicted_class_name": pred_class_name,
        "confidence": confidence,
        "top_predictions": top_predictions,
        "advice": advice,
        "prediction_id": new_pred.id,
        "comparison": comparison_pairs
    })

@app.get("/history_full/{email}")
def get_history_full(
    email: str,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    # Correction : accepte aussi "authorization" minuscule (certains navigateurs l'envoient ainsi)
    if not authorization:
        from fastapi import Request
        import inspect
        frame = inspect.currentframe()
        request = None
        while frame:
            if "request" in frame.f_locals:
                request = frame.f_locals["request"]
                break
            frame = frame.f_back
        if request:
            authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email_token = payload.get("sub")
        role = payload.get("role")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalide")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=403, detail="Utilisateur non trouvé ou non autorisé")
    if user.email != email_token:
        raise HTTPException(status_code=403, detail="Non autorisé")
    import json
    results = []
    for pred in sorted(user.predictions, key=lambda p: p.date, reverse=True):
        # Récupérer l'image
        image_path = Path(f"uploads/{pred.image_name}")
        image_data = None
        if image_path.exists():
            try:
                with open(image_path, "rb") as img_file:
                    image_data = base64.b64encode(img_file.read()).decode('utf-8')
            except Exception as e:
                print(f"Erreur lecture image {pred.image_name}: {str(e)}")
        
        results.append({
            "id": pred.id,
            "image_name": pred.image_name,
            "image_data": image_data,  # Ajout des données de l'image en base64
            "predicted_class": pred.predicted_class,
            "confidence": pred.confidence,
            "date": pred.date,
            "notes": pred.notes,
            "top_predictions": json.loads(pred.top_predictions) if pred.top_predictions else [],
            "comparison": json.loads(pred.comparison) if pred.comparison else None,
            "patient_nom": pred.patient_nom,
            "patient_prenom": pred.patient_prenom,
            "telephone": getattr(pred, "telephone", None),
            "sexe": getattr(pred, "sexe", None),
            "age": getattr(pred, "age", None),
        })
    return results

@app.put("/prediction/{prediction_id}/note")
def update_prediction_note(
    prediction_id: int,
    note_update: dict,  # <-- Change BaseModel to dict for direct JSON parsing
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        role = payload.get("role")
    except Exception as e:
        print("Erreur décodage JWT:", str(e))
        raise HTTPException(status_code=401, detail="Token invalide")
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prédiction non trouvée")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if prediction.user_id != user.id:
        raise HTTPException(status_code=403, detail="Accès interdit")

    # Vérifie le rôle ici si nécessaire
    if role != "admin":
        # Si ce n'est pas un admin, on peut imaginer d'autres vérifications
        pass

    # Traitement de la note
    note_text = note_update.get("note") if note_update else None
    if not note_text or not note_text.strip():
        raise HTTPException(status_code=400, detail="Le commentaire ne peut pas être vide.")
    notes = []
    try:
        if getattr(prediction, "notes", None):
            notes = json.loads(prediction.notes)
        else:
            notes = []
    except Exception:
        notes = []
    if not isinstance(notes, list):
        notes = []
    notes.insert(0, {
        "note": note_text,
        "date": datetime.utcnow().isoformat()
    })
    prediction.notes = json.dumps(notes, ensure_ascii=False)
    db.commit()
    db.refresh(prediction)
    return {"msg": "Note enregistrée", "notes": notes}


@app.get("/prediction/{prediction_id}/notes")
def get_prediction_notes(
    prediction_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalide")
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        # Correction : retourne une liste vide au lieu d'une erreur 404
        return {"notes": []}
    user = db.query(User).filter(User.email == email).first()
    if not user or prediction.user_id != user.id:
        raise HTTPException(status_code=403, detail="Non autorisé")
    import json
    notes = []
    try:
        notes = json.loads(prediction.notes) if getattr(prediction, "notes", None) else []
    except Exception:
        notes = []
    return {"notes": notes}

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    telephone = Column(String, nullable=True)
    sexe = Column(String, nullable=True)
    age = Column(String, nullable=True)

class PatientForm(BaseModel):
    nom: str
    prenom: str
    telephone: str | None = None
    sexe: str | None = None
    age: str | None = None

@app.post("/patients/create_or_get")
def create_or_get_patient(form: PatientForm, db: Session = Depends(get_db)):
    # Recherche un patient existant par téléphone si fourni, sinon par nom+prenom+age
    patient = None
    if form.telephone:
        patient = db.query(Patient).filter(Patient.telephone == form.telephone).first()
    if not patient:
        patient = db.query(Patient).filter(
            Patient.nom == form.nom,
            Patient.prenom == form.prenom,
            Patient.age == form.age
        ).first()
    if not patient:
        patient = Patient(
            nom=form.nom,
            prenom=form.prenom,
            telephone=form.telephone,
            sexe=form.sexe,
            age=form.age
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
    return {
        "id": patient.id,
        "nom": patient.nom,
        "prenom": patient.prenom,
        "telephone": patient.telephone,
        "sexe": patient.sexe,
        "age": patient.age
    }

def generate_unique_filename(original_filename: str) -> str:
    """Génère un nom de fichier unique en ajoutant un UUID et la date."""
    ext = os.path.splitext(original_filename)[1]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    return f"{timestamp}_{unique_id}{ext}"

def ensure_uploads_dir():
    """S'assure que le dossier uploads existe."""
    uploads_dir = Path("uploads")
    if not uploads_dir.exists():
        uploads_dir.mkdir(parents=True, exist_ok=True)
    return uploads_dir

@app.delete("/delete_prediction/{prediction_id}")
def delete_prediction(
    prediction_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalide")

    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prédiction non trouvée")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if prediction.user_id != user.id:
        raise HTTPException(status_code=403, detail="Accès interdit")

    # Supprimer l'image associée si elle existe
    if prediction.image_name:
        image_path = Path(f"uploads/{prediction.image_name}")
        if image_path.exists():
            try:
                image_path.unlink()
            except Exception as e:
                print(f"Erreur lors de la suppression de l'image {prediction.image_name}: {str(e)}")

    # Supprimer la prédiction de la base de données
    db.delete(prediction)
    db.commit()

    return {"message": "Prédiction supprimée avec succès"}

@app.get("/prediction/{prediction_id}/image")
async def get_prediction_image(
    prediction_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Récupère l'image associée à une prédiction."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalide")

    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prédiction non trouvée")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if prediction.user_id != user.id:
        raise HTTPException(status_code=403, detail="Accès interdit")

    if not prediction.image_name:
        raise HTTPException(status_code=404, detail="Aucune image associée à cette prédiction")

    image_path = Path("uploads") / prediction.image_name
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image non trouvée sur le serveur")

    try:
        return FileResponse(
            path=image_path,
            media_type="image/jpeg",
            filename=prediction.image_name
        )
    except Exception as e:
        print(f"Erreur lors de la récupération de l'image {prediction.image_name}: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération de l'image")

def clean_disease_name(raw):
    return re.sub(r'^\d+\.\s*', '', re.sub(r'\s*-?\s*\d+[a-zA-Z\. ]*$', '', raw)).strip()

