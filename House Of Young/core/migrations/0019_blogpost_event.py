# Generated by Django 4.2.9 on 2024-01-24 10:35

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0018_remove_event_collaborator_remove_event_sponsor_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='blogpost',
            name='event',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='blog_posts', to='core.event'),
        ),
    ]
