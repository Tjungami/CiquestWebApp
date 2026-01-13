from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0014_user_refresh_token"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notice",
            fields=[
                ("notice_id", models.AutoField(primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=120)),
                ("body_md", models.TextField()),
                (
                    "target",
                    models.CharField(
                        choices=[
                            ("all", "全員"),
                            ("owner", "オーナー"),
                            ("user", "ユーザー"),
                        ],
                        default="all",
                        max_length=20,
                    ),
                ),
                ("start_at", models.DateTimeField()),
                ("end_at", models.DateTimeField()),
                ("is_published", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_notices",
                        to="ciquest_model.adminaccount",
                    ),
                ),
            ],
            options={
                "ordering": ["-start_at", "-created_at"],
            },
        ),
    ]
