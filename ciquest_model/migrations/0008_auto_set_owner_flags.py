from django.db import migrations


def mark_existing_owners(apps, schema_editor):
    StoreOwner = apps.get_model("ciquest_model", "StoreOwner")
    StoreOwner.objects.update(is_verified=True, onboarding_completed=True)


def reverse_mark_existing_owners(apps, schema_editor):
    # No-op: we cannot determine previous values safely.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0007_storeowner_business_name_storeowner_contact_phone"),
    ]

    operations = [
        migrations.RunPython(mark_existing_owners, reverse_mark_existing_owners),
    ]
