from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0017_merge_20260120_1415"),
    ]

    operations = [
        migrations.CreateModel(
            name="StoreStampHistory",
            fields=[
                ("store_stamp_history_id", models.AutoField(primary_key=True, serialize=False)),
                ("stamp_date", models.DateField()),
                ("stamped_at", models.DateTimeField()),
                ("store", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="ciquest_model.store")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="ciquest_model.user")),
            ],
        ),
        migrations.AddConstraint(
            model_name="storestamphistory",
            constraint=models.UniqueConstraint(fields=("user", "store", "stamp_date"), name="uq_store_stamp_day"),
        ),
    ]
