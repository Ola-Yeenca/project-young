"""Emails sent when an enquiry arrives. Failures are logged, never shown to the visitor."""

import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string

from apps.core.models import SiteSettings

from .models import BookingEnquiry

logger = logging.getLogger(__name__)


def team_address(enquiry):
    site = SiteSettings.load()
    if isinstance(enquiry, BookingEnquiry):
        return site.booking_email or site.contact_email or settings.HOY_TEAM_EMAIL
    return site.contact_email or settings.HOY_TEAM_EMAIL


def _send(subject, template, context, to, reply_to=None):
    body = render_to_string(template, context)
    message = EmailMessage(subject=subject, body=body, to=[to], reply_to=[reply_to] if reply_to else None)
    message.send(fail_silently=False)


def notify(enquiry):
    kind = "booking" if isinstance(enquiry, BookingEnquiry) else "contact"
    context = {"e": enquiry, "kind": kind}
    try:
        _send(
            f"[{enquiry.reference}] New {'booking enquiry' if kind == 'booking' else 'message'}: {enquiry}",
            f"enquiries/email/team_{kind}.txt",
            context,
            team_address(enquiry),
            reply_to=enquiry.email or None,
        )
    except Exception:
        logger.exception("Could not email the team about enquiry %s", enquiry.reference)
    if enquiry.email:
        try:
            _send(
                f"We got your message · {enquiry.reference}",
                "enquiries/email/client_ack.txt",
                context,
                enquiry.email,
                reply_to=team_address(enquiry),
            )
        except Exception:
            logger.exception("Could not send the confirmation for enquiry %s", enquiry.reference)
