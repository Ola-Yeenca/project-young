from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_musicstyle"),
        ("events", "0002_event_poster_alt_event_poster_fit_alter_event_poster"),
    ]

    operations = [
        migrations.AlterField(
            model_name="event",
            name="music_style",
            field=models.CharField(default="afrobeats", max_length=120),
        ),
    ]
