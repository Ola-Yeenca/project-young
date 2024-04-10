from collections.abc import Iterable
import logging
import qrcode
from core.api.utils import generate_qr_code
from qrcode.exceptions import DataOverflowError
from io import BytesIO
from django.core.files import File
from PIL import Image, ImageDraw
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify
from django.urls import reverse
from django.contrib.auth import get_user_model


logger = logging.getLogger(__name__)


class QRCodeMixin(models.Model):
    qr_code = models.ImageField(upload_to='qr_codes', blank=True)

    def generate_qr_code(self, data):
        try:
            qrcode_img = qrcode.make(data)
            canvas = Image.new('RGB', (290, 290), 'white')
            draw = ImageDraw.Draw(canvas)
            canvas.paste(qrcode_img)
            fname = f'qr_code-{self.sanitize_filename(data)}.png'
            buffer = BytesIO()
            canvas.save(buffer, 'PNG')
            self.qr_code.save(fname, File(buffer), save=False)
            canvas.close()
            logger.debug("QR code saved successfully.")
        except DataOverflowError as e:
            logger.error(f"Error generating QR code for {data}: {e}")
            raise ValidationError("Data overflow error while generating QR code.")
        except Exception as e:
            logger.error(f"Error saving QR code for {data}: {e}")
            raise ValidationError("Error saving QR code.")

        return self.qr_code

    def sanitize_filename(self, filename):
        return slugify(filename)

    class Meta:
        abstract = True


class Index(models.Model):
    event_date = models.DateTimeField(help_text='Date and time of the event')
    is_active = models.BooleanField(default=True, help_text='Check if the event is currently active')

    def __str__(self):
        return f"Homepage - {self.event_date}"

    class Meta:
        app_label = 'core'
        verbose_name_plural = 'Home Pages'
        ordering = ('-event_date',)


class Organizer(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text='Name of the organizer')
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Organizer'
        verbose_name_plural = 'Organizers'


class Event(models.Model):
    title = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to='events/', blank=True)
    event_date = models.DateTimeField(help_text='Date of the event', null=True, blank=True)
    tickets_available = models.PositiveIntegerField(default=0)
    ticket_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_published = models.BooleanField(default=False)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    organizer = models.ForeignKey(Organizer, on_delete=models.CASCADE, blank=True, null=True)
    qr_code = models.ImageField(upload_to='event_qrcodes/', blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)

        if not self.qr_code:
            qr_code_buffer = generate_qr_code(self.title, self.event_date)
            if qr_code_buffer:
                self.qr_code.save(f'qr_code_{self.slug}.png', qr_code_buffer, save=False)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

class BlogPost(models.Model):
    title = models.CharField(max_length=100)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, blank=True, null=True, related_name='blog_posts')
    image = models.ImageField(upload_to='blog_posts/')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=True, help_text='Check if the blog post is published')
    slug = models.SlugField(max_length=255, unique=True, blank=True)

    def get_absolute_url(self):
        return reverse('core:blog_detail', args=[str(self.id), self.slug])

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    class Meta:
        verbose_name_plural = 'Blog Posts'
        ordering = ('-created_at',)
