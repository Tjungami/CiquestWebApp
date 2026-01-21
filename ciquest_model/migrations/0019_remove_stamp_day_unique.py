from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("ciquest_model", "0018_store_stamp_history"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="storestamphistory",
            name="uq_store_stamp_day",
        ),
    ]
