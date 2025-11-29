from django.conf import settings
from django.core.mail import get_connection, send_mail
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "メール送信のデバッグ用：環境変数を表示し、テストメールを送信します。"

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            required=True,
            help="送信先メールアドレス（必須）",
        )
        parser.add_argument(
            "--subject",
            default="Ciquest test email",
            help="件名",
        )
        parser.add_argument(
            "--body",
            default="This is a test email from Ciquest.",
            help="本文",
        )
        parser.add_argument(
            "--timeout",
            type=int,
            default=5,
            help="接続タイムアウト秒数（デフォルト5秒）",
        )

    def handle(self, *args, **options):
        to_addr = options["to"]
        subject = options["subject"]
        body = options["body"]
        timeout = options["timeout"]

        # 設定の要点を表示（パスワードは伏せる）
        self.stdout.write("=== Email settings (masking password) ===")
        self.stdout.write(f"EMAIL_BACKEND: {getattr(settings, 'EMAIL_BACKEND', None)}")
        self.stdout.write(f"EMAIL_HOST: {getattr(settings, 'EMAIL_HOST', None)}")
        self.stdout.write(f"EMAIL_PORT: {getattr(settings, 'EMAIL_PORT', None)}")
        self.stdout.write(f"EMAIL_USE_TLS: {getattr(settings, 'EMAIL_USE_TLS', None)}")
        self.stdout.write(f"EMAIL_USE_SSL: {getattr(settings, 'EMAIL_USE_SSL', None)}")
        self.stdout.write(f"EMAIL_HOST_USER: {getattr(settings, 'EMAIL_HOST_USER', None)}")
        self.stdout.write("EMAIL_HOST_PASSWORD: ******")
        self.stdout.write(f"DEFAULT_FROM_EMAIL: {getattr(settings, 'DEFAULT_FROM_EMAIL', None)}")
        self.stdout.write("=========================================")

        try:
            connection = get_connection(timeout=timeout)
            sent = send_mail(
                subject,
                body,
                getattr(settings, "DEFAULT_FROM_EMAIL", None)
                or getattr(settings, "EMAIL_HOST_USER", None)
                or "no-reply@ciquest.local",
                [to_addr],
                fail_silently=False,
                connection=connection,
            )
            self.stdout.write(self.style.SUCCESS(f"Sent messages: {sent}"))
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Send failed: {exc}"))
            raise
