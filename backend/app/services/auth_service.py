import secrets

from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.payment import Payment
from app.models.therapy_session import TherapySession
from app.models.user import User
from app.models.user_preference import UserPreference
from app.repositories.user_repository import UserRepository
from app.services.social_auth import SocialAuthError, verify_firebase
from app.utils.email_validation import validate_account_email


class AuthService:

    @staticmethod
    def register(db: Session, data: dict):
        # Reject disposable/undeliverable addresses with a soft message and
        # normalize the address before it becomes the account key.
        check = validate_account_email(data.get("email", ""))
        if not check["valid"]:
            return {"success": False, "message": check["message"]}, 400
        data["email"] = check["email"]

        existing_user = UserRepository.find_by_email(db, data["email"])

        if existing_user:
            return {
                "success": False,
                "message": "Email already exists",
            }, 400

        data["password"] = hash_password(data["password"])
        user = UserRepository.create_user(db, data)

        return {
            "success": True,
            "message": "User registered successfully",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
            },
        }, 201

    @staticmethod
    def login(db: Session, data: dict):
        user = UserRepository.find_by_email(db, data["email"])

        if not user or not verify_password(data["password"], user.password):
            return {
                "success": False,
                "message": "Invalid email or password",
            }, 401

        # An admin-deleted account keeps its row (records reference it) but must
        # not be able to sign back in.
        if user.is_active is False:
            return {
                "success": False,
                "message": "This account has been deactivated. Please contact your administrator.",
            }, 403

        # RBAC gate: reject a valid credential trying to use the wrong app.
        expected_role = data.get("expected_role")
        if expected_role and (not user.role or user.role.name != expected_role):
            return {
                "success": False,
                "message": "This account is not permitted to use this app",
            }, 403

        return {
            "success": True,
            "message": "Login successful",
            "access_token": create_access_token(str(user.id), user.token_version or 0),
            "refresh_token": create_refresh_token(str(user.id), user.token_version or 0),
            # Full profile (includes auth_provider/social_linked for Settings)
            "user": user.to_dict(),
        }, 200

    @staticmethod
    def social_login(db: Session, data: dict):
        """Sign in (or sign up) with a Firebase-verified identity.

        Firebase Auth proves ownership of the email (whichever provider the
        user picked in the app); we then reuse the account with that email or
        create a fresh patient account. Sign-up via social is patient-only —
        doctor/admin accounts are provisioned by an admin, so an unknown email
        asked for by those apps is rejected instead of created.
        """
        try:
            profile = verify_firebase(data["id_token"])
        except SocialAuthError as exc:
            return {"success": False, "message": exc.message}, exc.status_code

        if not profile["email_verified"]:
            return {
                "success": False,
                "message": "This account's email address is not verified with the provider",
            }, 403

        expected_role = data.get("expected_role")
        # A linked social identity (Settings → Linked accounts) wins over email
        # matching, so any role can sign in with a social account whose email
        # differs from the account email.
        user = None
        if profile.get("uid"):
            user = db.query(User).filter_by(firebase_uid=profile["uid"]).first()
        if user is None:
            user = UserRepository.find_by_email(db, profile["email"])

        if user is None:
            if expected_role not in (None, "patient"):
                return {
                    "success": False,
                    "message": "No account found for this email. Please contact your administrator.",
                }, 403
            # Random throwaway password: the account is provider-backed and can
            # never be entered via the password form.
            user = UserRepository.create_user(
                db,
                {
                    "full_name": profile["full_name"],
                    "email": profile["email"],
                    "password": hash_password(secrets.token_urlsafe(32)),
                },
            )
            user.auth_provider = profile["provider"] or None
            user.firebase_uid = profile.get("uid")
            if profile.get("avatar_url"):
                user.avatar_url = profile["avatar_url"]
            db.commit()
            db.refresh(user)
        elif user.is_active is False:
            return {
                "success": False,
                "message": "This account has been deactivated. Please contact your administrator.",
            }, 403
        elif expected_role and (not user.role or user.role.name != expected_role):
            return {
                "success": False,
                "message": "This account is not permitted to use this app",
            }, 403
        elif not user.firebase_uid and profile.get("uid"):
            # First social sign-in on an email-matched account: bind the
            # identity so it shows under Linked accounts and future provider
            # email changes don't break the mapping.
            user.firebase_uid = profile["uid"]
            user.auth_provider = user.auth_provider or profile["provider"] or None
            db.commit()

        return {
            "success": True,
            "message": "Login successful",
            "access_token": create_access_token(str(user.id), user.token_version or 0),
            "refresh_token": create_refresh_token(str(user.id), user.token_version or 0),
            "user": user.to_dict(),
        }, 200

    @staticmethod
    def link_social(db: Session, user: User, data: dict):
        """Bind a Firebase-verified social identity to the logged-in account.

        The provider email may differ from the account email — that's the
        point: afterwards the social button logs into THIS account (any role).
        """
        try:
            profile = verify_firebase(data["id_token"])
        except SocialAuthError as exc:
            return {"success": False, "message": exc.message}, exc.status_code

        uid = profile.get("uid")
        if not uid:
            return {"success": False, "message": "Sign-in token has no user id"}, 400

        holder = db.query(User).filter_by(firebase_uid=uid).first()
        if holder is not None and holder.id != user.id:
            return {
                "success": False,
                "message": "This social account is already linked to another user",
            }, 409

        user.firebase_uid = uid
        user.auth_provider = profile["provider"] or None
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": f"{(profile['provider'] or 'Social').capitalize()} account linked successfully",
            "user": user.to_dict(),
        }, 200

    @staticmethod
    def unlink_social(db: Session, user: User):
        if not user.firebase_uid:
            return {"success": False, "message": "No social account is linked"}, 400

        user.firebase_uid = None
        user.auth_provider = None
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": "Social account unlinked",
            "user": user.to_dict(),
        }, 200

    @staticmethod
    def change_email(db: Session, user: User, data: dict):
        """Change the login email.

        Password accounts must confirm the current password. Social-created
        accounts have a random unusable password, so a linked social identity
        stands in as the proof instead.
        """
        new_email = data["new_email"].lower().strip()

        if user.auth_provider is None or data.get("current_password"):
            if not data.get("current_password"):
                return {"success": False, "message": "Current password is required"}, 400
            if not verify_password(data["current_password"], user.password):
                return {"success": False, "message": "Current password is incorrect"}, 401

        existing = UserRepository.find_by_email(db, new_email)
        if existing and existing.id != user.id:
            return {"success": False, "message": "Email already exists"}, 400

        user.email = new_email
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": "Email updated successfully",
            "user": user.to_dict(),
        }, 200

    @staticmethod
    def update_profile(db: Session, user: User, data: dict):
        if data.get("full_name") is not None:
            user.full_name = data["full_name"]
        if data.get("avatar_url") is not None:
            user.avatar_url = data["avatar_url"]
        if data.get("phone") is not None:
            user.phone = data["phone"]
        if data.get("gender") is not None:
            user.gender = data["gender"]
        if data.get("date_of_birth") is not None:
            user.date_of_birth = data["date_of_birth"]
        for field in ("blood_group", "height_cm", "weight_kg", "allergies", "conditions", "medications"):
            if data.get(field) is not None:
                value = data[field]
                # An empty string is how the app clears a free-text field.
                user_value = value.strip() or None if isinstance(value, str) else value
                setattr(user, field, user_value)
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": "Profile updated successfully",
            "user": user.to_dict(),
        }, 200

    @staticmethod
    def change_password(db: Session, user: User, data: dict):
        if not verify_password(data["current_password"], user.password):
            return {"success": False, "message": "Current password is incorrect"}, 401

        user.password = hash_password(data["new_password"])
        # Invalidate every previously issued token (access + refresh)
        user.token_version = (user.token_version or 0) + 1
        db.commit()

        return {
            "success": True,
            "message": "Password changed successfully",
            "access_token": create_access_token(str(user.id), user.token_version),
            "refresh_token": create_refresh_token(str(user.id), user.token_version),
        }, 200

    @staticmethod
    def request_account_deletion(db: Session, user: User):
        """Raise a deletion *request* for an admin to action.

        Patients no longer wipe their own account from the app — the data has
        clinical value (appointments, therapy history, scans) and the call is
        the clinic's to make. This notifies every admin and leaves the account
        untouched; the actual removal happens from the admin console.
        """
        from app.models.role import Role
        from app.services.notification_service import NotificationService

        if db.query(Doctor).filter_by(user_id=user.id).first():
            return {
                "success": False,
                "message": "Doctor accounts cannot be deleted from the app",
            }, 400

        admin_ids = [
            row[0]
            for row in db.query(User.id)
            .join(Role, User.role_id == Role.id)
            .filter(Role.name == "admin", User.is_active.is_(True))
            .all()
        ]
        for admin_id in admin_ids:
            NotificationService.notify_safely(
                db,
                admin_id,
                "system",
                "account_deletion_requested",
                "Account deletion requested",
                f"{user.full_name} ({user.email}) has asked for their account to be deleted.",
                {"userId": str(user.id), "email": user.email},
            )

        return {
            "success": True,
            "message": "Deletion request submitted",
        }, 200

    @staticmethod
    def delete_account(db: Session, user: User):
        if db.query(Doctor).filter_by(user_id=user.id).first():
            return {
                "success": False,
                "message": "Doctor accounts cannot be deleted from the app",
            }, 400

        # Hard delete with explicit cascade of user-owned rows
        db.query(TherapySession).filter_by(user_id=user.id).delete()
        db.query(Payment).filter_by(user_id=user.id).delete()
        db.query(Appointment).filter_by(user_id=user.id).delete()
        db.query(UserPreference).filter_by(user_id=user.id).delete()
        db.delete(user)
        db.commit()

        return {"success": True, "message": "Account deleted successfully"}, 200
