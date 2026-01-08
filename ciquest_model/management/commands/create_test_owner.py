from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand

from ciquest_model.models import StoreOwner


class Command(BaseCommand):
    help = "テスト用オーナーアカウントを作成（既存なら更新）します。"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default="owner@example.com",
            help="作成するオーナーのメールアドレス（既存なら上書き）",
        )
        parser.add_argument(
            "--password",
            default="testpassword",
            help="設定するパスワード（ハッシュ化して保存されます）",
        )
        parser.add_argument(
            "--name",
            default="Test Owner",
            help="表示名（任意）",
        )

    def handle(self, *args, **options):
        email = options["email"].lower()
        password = options["password"]
        name = options["name"]

        owner, created = StoreOwner.objects.update_or_create(
            email=email,
            defaults={
                "password": make_password(password),
                "name": name,
                "approved": True,
                "is_verified": True,
                "onboarding_completed": True,
            },
        )

        status = "created" if created else "updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"[{status}] オーナー email={owner.email} password={password} approved={owner.approved}"
            )
        )
