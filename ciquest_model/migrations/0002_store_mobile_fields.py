from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="store",
            name="business_hours_json",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="store",
            name="instagram",
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="store",
            name="is_featured",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="store",
            name="main_image",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="store",
            name="phone",
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name="store",
            name="priority",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="store",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="store",
            name="website",
            field=models.URLField(blank=True, null=True),
        ),
    ]
