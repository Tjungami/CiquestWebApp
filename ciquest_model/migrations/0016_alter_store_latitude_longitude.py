from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0015_notice"),
    ]

    operations = [
        migrations.AlterField(
            model_name="store",
            name="latitude",
            field=models.DecimalField(decimal_places=12, max_digits=15),
        ),
        migrations.AlterField(
            model_name="store",
            name="longitude",
            field=models.DecimalField(decimal_places=12, max_digits=15),
        ),
    ]
