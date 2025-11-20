from django.db import migrations, models
import django.db.models.deletion


def approve_existing_admins(apps, schema_editor):
    AdminAccount = apps.get_model("ciquest_model", "AdminAccount")
    AdminAccount.objects.update(approval_status="approved", is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0009_adminaccount_two_person_guard"),
    ]

    operations = [
        migrations.AddField(
            model_name="adminaccount",
            name="approval_status",
            field=models.CharField(
                choices=[
                    ("pending", "申請中"),
                    ("approved", "承認済み"),
                    ("rejected", "却下"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="adminaccount",
            name="approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="adminaccount",
            name="approved_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="approved_admins",
                to="ciquest_model.adminaccount",
            ),
        ),
        migrations.AddField(
            model_name="adminaccount",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="created_admins",
                to="ciquest_model.adminaccount",
            ),
        ),
        migrations.AlterField(
            model_name="adminaccount",
            name="password",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.RunPython(approve_existing_admins, migrations.RunPython.noop),
    ]
