"""
Script CLI pour créer le premier user admin.

Usage:
    docker compose exec backend python scripts/create_admin.py
"""
import sys
import getpass
from sqlalchemy.orm import Session

sys.path.insert(0, "/app")

from database import SessionLocal
from models import User, UserRole
from utils.security import hash_password


def create_admin():
    print("=" * 60)
    print("  Création du premier user admin")
    print("=" * 60)
    
    email = input("Email : ").strip().lower()
    name = input("Nom complet : ").strip()
    password = getpass.getpass("Mot de passe (min 8 caractères) : ")
    
    if len(password) < 8:
        print("❌ Mot de passe trop court (8 caractères minimum)")
        sys.exit(1)
    
    password_confirm = getpass.getpass("Confirmer le mot de passe : ")
    if password != password_confirm:
        print("❌ Les mots de passe ne correspondent pas")
        sys.exit(1)
    
    db: Session = SessionLocal()
    try:
        # Vérifier que l'email n'existe pas déjà
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"❌ Un utilisateur avec l'email '{email}' existe déjà")
            sys.exit(1)
        
        # Créer le user
        user = User(
            email=email,
            name=name,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            is_active="Y"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print()
        print("=" * 60)
        print(f"✅ User admin créé avec succès !")
        print(f"   ID    : {user.id}")
        print(f"   Email : {user.email}")
        print(f"   Nom   : {user.name}")
        print(f"   Role  : {user.role.value}")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur : {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
