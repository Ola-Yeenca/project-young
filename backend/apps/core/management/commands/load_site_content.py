from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core import content
from apps.core.models import FAQ, SiteSettings


class Command(BaseCommand):
    help = "Apply the standard House of Young copy and FAQs. Text the team has edited is left alone."

    @transaction.atomic
    def handle(self, *args, **options):
        site = SiteSettings.load()
        changed = []
        if site.tagline.strip() in ("", content.OLD_TAGLINE):
            site.tagline = content.MOTTO
            changed.append("motto")
        if site.about.strip() in ("", content.OLD_ABOUT):
            site.about = content.ABOUT
            changed.append("about")
        site.save()

        hidden = 0
        for question, answer in content.SUPERSEDED_FAQS.items():
            hidden += FAQ.objects.filter(question=question, answer=answer, is_published=True).update(is_published=False)

        added = 0
        for order, (category, question, answer) in enumerate(content.FAQS):
            faq, created = FAQ.objects.get_or_create(question=question, defaults=dict(category=category, answer=answer, order=order))
            added += created
            if not created and faq.answer == answer and faq.order != order:
                faq.order = order
                faq.save(update_fields=["order", "updated_at"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Site settings: {', '.join(changed) or 'already up to date'}. FAQs: {added} added, {hidden} old sample answers hidden."
            )
        )
