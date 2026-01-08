from django.contrib.auth.hashers import identify_hasher, make_password
from django.core.management.base import BaseCommand

from ciquest_model.models import AdminAccount, StoreOwner, User


def _needs_hash(password):
    if not password:
        return False
    try:
        identify_hasher(password)
        return False
    except ValueError:
        return True


class Command(BaseCommand):
    help = "既存の平文パスワードをハッシュ化します。"

    def handle(self, *args, **options):
        updated = 0
        for model in (User, StoreOwner, AdminAccount):
            for obj in model.objects.all().iterator():
                if _needs_hash(obj.password):
                    obj.password = make_password(obj.password)
                    obj.save(update_fields=["password"])
                    updated += 1

        self.stdout.write(self.style.SUCCESS(f"ハッシュ化完了: {updated} 件更新しました。"))
