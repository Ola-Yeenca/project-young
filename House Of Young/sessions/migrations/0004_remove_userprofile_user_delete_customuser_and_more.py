# Generated by Django 4.2.10 on 2024-03-20 14:38

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users_sessions', '0003_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='userprofile',
            name='user',
        ),
        migrations.DeleteModel(
            name='CustomUser',
        ),
        migrations.DeleteModel(
            name='UserProfile',
        ),
    ]
