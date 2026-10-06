"""Create the first admin from environment variables, once.

Set DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL and DJANGO_SUPERUSER_PASSWORD
on the host. On start-up this creates that admin if it doesn't exist yet and does
nothing otherwise, so the password can be changed later in Studio without being
overwritten. Remove the password variable once you've signed in.
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the first admin from DJANGO_SUPERUSER_* variables if it doesn't exist."

    def handle(self, *args, **options):
        username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")
        if not username or not password:
            self.stdout.write("ensure_admin: no DJANGO_SUPERUSER_USERNAME/PASSWORD set, skipping.")
            return
        User = get_user_model()
        if User.objects.filter(username=username).exists():
            self.stdout.write(f"ensure_admin: {username} already exists, leaving it unchanged.")
            return
        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"ensure_admin: created admin {username}."))
