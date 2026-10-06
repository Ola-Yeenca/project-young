from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.enquiries.models import BookingEnquiry, ContactEnquiry


class Command(BaseCommand):
    help = "Delete enquiries older than the retention period (GDPR / NDPA data minimisation)."

    def add_arguments(self, parser):
        parser.add_argument("--months", type=int, default=24)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, months, dry_run, **options):
        cutoff = timezone.now() - timedelta(days=round(months * 30.44))
        total = 0
        for model in (BookingEnquiry, ContactEnquiry):
            qs = model.objects.filter(created_at__lt=cutoff)
            count = qs.count()
            total += count
            if not dry_run:
                qs.delete()
            self.stdout.write(f"{model._meta.verbose_name_plural}: {count}")
        verb = "Would delete" if dry_run else "Deleted"
        self.stdout.write(self.style.SUCCESS(f"{verb} {total} enquiries older than {months} months."))
