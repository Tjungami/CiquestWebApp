from django.contrib.auth.hashers import make_password

from ciquest_model.models import AdminAccount


def create_admin_accounts():
    accounts = [
        {"name": "HQ Admin", "email": "admin@example.com", "password": "9999"},
        {"name": "Omotesando Ops", "email": "omotesando@example.com", "password": "admin123"},
        {"name": "Umeda Ops", "email": "umeda@example.com", "password": "secret456"},
    ]
    for account in accounts:
        obj, created = AdminAccount.objects.update_or_create(
            email=account["email"],
            defaults={
                "name": account["name"],
                "password": make_password(account["password"]),
                "is_active": True,
                "approval_status": "approved",
            },
        )
        status = "created" if created else "updated"
        print(f"[{status}] {obj.name} ({obj.email})")


if __name__ == "__main__":
    create_admin_accounts()
