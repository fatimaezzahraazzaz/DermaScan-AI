from fastapi import APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Header
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, create_engine, ForeignKey, Text  # Ajoute Text
from sqlalchemy.orm import sessionmaker, declarative_base, Session, relationship
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import inspect

# Configuration
SECRET_KEY = "TON_SECRET_KEY_SUPER_SECRET"  # change ça !
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# DB Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./users.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Si tu veux supprimer le warning, mets à jour la librairie bcrypt :
# pip install --upgrade bcrypt

# User model SQLAlchemy
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    nom = Column(String, nullable=True)
    prenom = Column(String, nullable=True)
    age = Column(String, nullable=True)
    sexe = Column(String, nullable=True)
    telephone = Column(String, nullable=True)  # <-- Ajout du numéro de téléphone
    role = Column(String, nullable=False)
    predictions = relationship("Prediction", back_populates="user")

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    image_name = Column(String, nullable=True)
    predicted_class = Column(String, nullable=False)
    confidence = Column(String, nullable=True)
    date = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    top_predictions = Column(Text, nullable=True)
    comparison = Column(Text, nullable=True)
    patient_nom = Column(String, nullable=True)      # <-- Ajout
    patient_prenom = Column(String, nullable=True)   # <-- Ajout
    telephone = Column(String, nullable=True)         # <-- Ajout
    sexe = Column(String, nullable=True)              # <-- Ajout
    age = Column(String, nullable=True)               # <-- Ajout
    user = relationship("User", back_populates="predictions")

# Pydantic schemas
class UserCreate(BaseModel):
    email: str
    password: str
    nom: str | None = None
    prenom: str | None = None
    age: str | None = None
    sexe: str | None = None
    telephone: str | None = None  # <-- Ajout du numéro de téléphone
    role: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class PredictionOut(BaseModel):
    id: int
    image_name: str | None = None
    predicted_class: str
    confidence: str | None = None
    date: str

    class Config:
        orm_mode = True

# Create DB tables
Base.metadata.create_all(bind=engine)

# Helpers
def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Créer un utilisateur admin par défaut s'il n'existe pas
def create_default_admin():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == "admin@dermascan.com").first()
        if not admin_user:
            hashed_password = get_password_hash("admin")
            admin_user = User(
                email="admin@dermascan.com",
                hashed_password=hashed_password,
                nom="Administrateur",
                prenom="Admin",
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            print("Utilisateur admin créé avec succès")
    except Exception as e:
        print(f"Erreur lors de la création de l'admin: {e}")
    finally:
        db.close()

# Créer l'admin au démarrage
create_default_admin()

# FastAPI router
router = APIRouter()

@router.post("/register", status_code=201)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        hashed_password=hashed_password,
        nom=user.nom,
        prenom=user.prenom,
        age=user.age,
        sexe=user.sexe,
        telephone=user.telephone,  # <-- Ajout du numéro de téléphone
        role=user.role,  # Enregistre le rôle
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"msg": "Utilisateur créé avec succès"}

@router.post("/login", response_model=Token)
def login(request: Request, user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")
    # Vérifie le rôle attendu dans l'URL (query param)
    role_expected = request.query_params.get("role")
    if role_expected and db_user.role != role_expected:
        # Retourne le vrai rôle, le redirect et un message explicite
        access_token = create_access_token(data={
            "sub": db_user.email,
            "role": db_user.role,
            "prenom": db_user.prenom,
            "nom": db_user.nom
        })
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": db_user.role,
            "redirect": f"/login?role={db_user.role}",
            "message": f"Ce n'est pas le bon espace. Veuillez vous connecter sur la page {db_user.role}."
        }
    access_token = create_access_token(data={
        "sub": db_user.email,
        "role": db_user.role,
        "prenom": db_user.prenom,
        "nom": db_user.nom
    })
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": db_user.role
    }

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "nom": user.nom,
            "prenom": user.prenom,
            "age": user.age,
            "sexe": user.sexe,
            "telephone": user.telephone,  # <-- Ajout du numéro de téléphone
            "role": user.role,
        }
        for user in users
    ]

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Empêcher la suppression de l'admin
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Impossible de supprimer l'administrateur")
    
    # Supprimer d'abord toutes les prédictions associées
    db.query(Prediction).filter(Prediction.user_id == user_id).delete()
    
    # Puis supprimer l'utilisateur
    db.delete(user)
    db.commit()
    return {"msg": "Utilisateur supprimé avec succès"}

@router.put("/users/{user_id}")
def update_user(user_id: int, update_data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Empêcher la modification du rôle admin
    if user.role == "admin" and "role" in update_data and update_data["role"] != "admin":
        raise HTTPException(status_code=403, detail="Impossible de modifier le rôle de l'administrateur")
    
    # Mettre à jour les champs autorisés
    allowed_fields = ["nom", "prenom", "age", "sexe", "telephone", "role"]
    for field in allowed_fields:
        if field in update_data:
            setattr(user, field, update_data[field])
    
    db.commit()
    db.refresh(user)
    return {"msg": "Utilisateur mis à jour avec succès"}

@router.get("/history/{email}", response_model=list[PredictionOut])
def get_history(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    # Trie l'historique du plus récent au plus ancien
    return sorted(user.predictions, key=lambda p: p.date, reverse=True)

@router.put("/users/update_profile")
def update_profile(
    update: dict,
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
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    # Met à jour les champs si présents dans la requête
    for field in ["nom", "prenom", "sexe", "age", "telephone"]:  # <-- Ajout "telephone"
        if field in update:
            setattr(user, field, update[field])
    db.commit()
    db.refresh(user)
    return {"msg": "Profil mis à jour"}

# Après avoir ajouté la colonne "telephone" dans la classe User,
# il faut générer la migration ou supprimer le fichier users.db pour SQLite
# et relancer l'app pour que SQLAlchemy crée la colonne.

# Solution rapide pour développement local :
# 1. Arrête le serveur.
# 2. Supprime le fichier SQLite existant (users.db) :
#    (Attention : cela supprime tous les utilisateurs existants !)
#    - Windows : supprime le fichier d:\S2\projet\skin-app\backend\users.db
# 3. Relance le backend, la base sera régénérée avec la colonne telephone.

# Si tu veux migrer sans perdre les données, il faut utiliser Alembic pour générer une migration.
# Mais pour un projet en dev/local, la suppression du fichier suffit.

