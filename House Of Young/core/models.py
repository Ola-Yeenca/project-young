# models.py
from collections.abc import Iterable
import logging
import qrcode
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

class Organizer(models.Model):
    user = models.OneToOneField(get_user_model(), on_delete=models.CASCADE)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

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
        except Exception as e:
            logger.error(f"Error saving QR code for {data}: {e}")
        finally:
            return self.qr_code

    def sanitize_filename(self, filename):
        return slugify(filename)

    class Meta:
        abstract = True

class Homepage(models.Model):
    event_date = models.DateTimeField(help_text='Date and time of the event')
    is_active = models.BooleanField(default=True, help_text='Check if the event is currently active')


    def __str__(self):
        return f"Homepage - {self.event_date}"
    class Meta:
        app_label = 'core'
        verbose_name_plural = 'Home Pages'
        ordering = ('-event_date',)

class Venue(models.Model):
    address = models.CharField(max_length=225)
    city = models.CharField(max_length=225)
    country = models.CharField(max_length=225)

    def __str__(self):
        return self.address

class Event(QRCodeMixin, models.Model):
    home_page = models.ForeignKey('core.HomePage', on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to='events/', blank=True)
    event_date = models.DateTimeField(help_text='Date of the event', null=True, blank=True, default=None)
    sponsor = models.CharField(max_length=255, blank=True, null=True)
    collaborator = models.CharField(max_length=255, blank=True, null=True)
    organizer = models.ForeignKey(Organizer, on_delete=models.CASCADE, default=1)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, default=1)  # Set default to a valid Venue instance
    tickets_available = models.PositiveIntegerField(default=0)
    qr_code = models.ImageField(upload_to='qr_codes', blank=True)
    ticket_price = models.DecimalField(max_digits=1000, decimal_places=2, default=0, help_text='€')
    is_published = models.BooleanField(default=True, help_text='Check if the event is published')
    slug = models.SlugField(max_length=255, unique=True, blank=True)

    def get_absolute_url(self):
        return reverse('core:event_detail', args=[str(self.id), self.slug])

    def save(self, *args, **kwargs):
        if not self.id:
            self.generate_qr_code(self.title)

        if not self.slug:
            self.slug = slugify(self.title)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Collaborator(QRCodeMixin, models.Model):
    user = models.OneToOneField(get_user_model(), on_delete=models.CASCADE)
    organizer = models.ForeignKey(Organizer, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='collaborators')  # Add a unique related_name
    qr_code = models.ImageField(upload_to='qr_codes/collaborators', blank=True)

    def save(self, *args, **kwargs):
        if not self.qr_code:
            self.generate_qr_code(self.user.username)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.organizer.name} - {self.event.title}"

    
class Session(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    description = models.TextField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()

    def __str__(self):
        return self.title

class Sponsor(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    logo = models.ImageField(upload_to='sponsor_logos/')
    events = models.ManyToManyField(Event, related_name='sponsors')

    def __str__(self):
        return self.name

class BlogPost(models.Model):
    title = models.CharField(max_length=100)
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

class Attendee(models.Model):
    user = models.OneToOneField(get_user_model(), on_delete=models.CASCADE)
    events_attending = models.ManyToManyField(Event, related_name='attendees')

    def __str__(self):
        return self.user.username

SHAPE_CHOICES = (
    ('1', 'Cube'),
    ('2', 'Sphere'),
    ('3', 'Torus'),
    ('4', 'Cylinder'),
    ('5', 'Plane'),
    ('6', 'Heart'),
    ('7', 'Dodecahedron'),
    ('8', 'Octahedron'),
    ('9', 'Icosahedron'),
    ('10', 'Tetrahedron'),
    ('11', 'Ring'),
    ('12', 'Knot'),
    ('13', 'Polyhedron'),
    ('14', 'TorusKnot'),
    ('15', 'Stars')
)

class Webgel(models.Model):
    type = models.CharField(max_length=3, choices=SHAPE_CHOICES)
    color = models.CharField(max_length=7, help_text='Hex color code')

    def __str__(self):
        return str(self.id)
