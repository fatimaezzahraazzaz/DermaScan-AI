import sqlite3
conn = sqlite3.connect("users.db")
c = conn.cursor()
try:
    c.execute("ALTER TABLE predictions ADD COLUMN patient_nom TEXT")
except Exception as e:
    print("patient_nom déjà existant ou erreur :", e)
try:
    c.execute("ALTER TABLE predictions ADD COLUMN patient_prenom TEXT")
except Exception as e:
    print("patient_prenom déjà existant ou erreur :", e)
try:
    c.execute("ALTER TABLE predictions ADD COLUMN telephone TEXT")
except Exception as e:
    print("telephone déjà existant ou erreur :", e)
try:
    c.execute("ALTER TABLE predictions ADD COLUMN sexe TEXT")
except Exception as e:
    print("sexe déjà existant ou erreur :", e)
try:
    c.execute("ALTER TABLE predictions ADD COLUMN age TEXT")
except Exception as e:
    print("age déjà existant ou erreur :", e)
conn.commit()
conn.close()
print("Migration terminée.")
