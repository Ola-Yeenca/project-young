# Generated by Django 4.2.9 on 2024-02-05 20:47

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('custom_user', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='adminuser',
            name='email',
            field=models.EmailField(max_length=254, unique=True),
        ),
    ]
