from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0010_adminaccount_two_person_guard_fix"),
    ]

    operations = [
        migrations.AddField(
            model_name="adminaccount",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="adminaccount",
            name="is_deleted",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="adminaccount",
            name="restore_token",
            field=models.CharField(blank=True, max_length=128, null=True),
        ),
        migrations.AddField(
            model_name="adminaccount",
            name="restore_token_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
