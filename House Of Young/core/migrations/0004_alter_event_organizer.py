# Generated by Django 4.2.9 on 2024-01-17 17:57

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_attendee_collaborator_organizer_session_sponsor_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='organizer',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.organizer'),
        ),
    ]
