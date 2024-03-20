# Generated by Django 4.2.10 on 2024-03-20 14:53

import django.core.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('custom_user', '0002_alter_adminuser_email'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('email', models.EmailField(max_length=254, unique=True, validators=[django.core.validators.EmailValidator()])),
                ('first_name', models.CharField(max_length=30)),
                ('last_name', models.CharField(default='', max_length=30)),
                ('username', models.CharField(max_length=150, unique=True)),
                ('email_is_verified', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('date_joined', models.DateTimeField(auto_now_add=True)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='%(app_label)s_%(class)s_groups', related_query_name='custom_user_group', to='auth.group', verbose_name='Groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='%(app_label)s_%(class)s_permissions', related_query_name='custom_user_permission', to='auth.permission', verbose_name='User permissions')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone_number', models.CharField(blank=True, default='', max_length=15)),
                ('bio', models.TextField(blank=True, default='', max_length=500)),
                ('location', models.CharField(blank=True, default='', max_length=30)),
                ('birth_date', models.DateField(blank=True, null=True)),
                ('avatar', models.ImageField(blank=True, default='default.jpg', null=True, upload_to='profile_images')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to='custom_user.customuser')),
            ],
        ),
        migrations.RemoveField(
            model_name='organizerprofile',
            name='user',
        ),
        migrations.AlterModelManagers(
            name='adminuser',
            managers=[
            ],
        ),
        migrations.DeleteModel(
            name='CollaboratorProfile',
        ),
        migrations.DeleteModel(
            name='OrganizerProfile',
        ),
    ]
