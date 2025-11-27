from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "指定した認証情報でスーパーユーザーを作成/更新します（パスワードは上書き）。"

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            default="admin",
            help="スーパーユーザーのユーザー名（既存なら上書き）",
        )
        parser.add_argument(
            "--email",
            default="admin@example.com",
            help="メールアドレス（任意）",
        )
        parser.add_argument(
            "--password",
            default="password",
            help="設定するパスワード（平文で保存されます）",
        )

    def handle(self, *args, **options):
        username = options["username"]
        email = options["email"]
        password = options["password"]

        User = get_user_model()
        user, created = User.objects.update_or_create(
            username=username,
            defaults={"email": email},
        )
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        status = "created" if created else "updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"[{status}] superuser username={user.username} password={password}"
            )
        )
