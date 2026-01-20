from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0003_storestampsetting_storestampreward"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserCouponUsageHistory",
            fields=[
                ("user_coupon_usage_history_id", models.AutoField(primary_key=True, serialize=False)),
                ("coupon_type", models.CharField(choices=[("common", "共通"), ("store_specific", "店舗独自")], max_length=20)),
                ("used_at", models.DateTimeField()),
                ("coupon", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="ciquest_model.coupon")),
                ("store", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="ciquest_model.store")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="ciquest_model.user")),
            ],
            options={
                "ordering": ["-used_at"],
            },
        ),
        migrations.CreateModel(
            name="StoreCouponUsageHistory",
            fields=[
                ("store_coupon_usage_history_id", models.AutoField(primary_key=True, serialize=False)),
                ("coupon_type", models.CharField(choices=[("common", "共通"), ("store_specific", "店舗独自")], max_length=20)),
                ("used_at", models.DateTimeField()),
                ("coupon", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="ciquest_model.coupon")),
                ("store", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="ciquest_model.store")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="ciquest_model.user")),
            ],
            options={
                "ordering": ["-used_at"],
            },
        ),
    ]
