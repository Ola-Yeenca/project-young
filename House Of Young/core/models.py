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

logger = logging.getLogger(__name__)

class HomePage(models.Model):
    title = models.CharField(max_length=100)
    about = models.TextField()
    image = models.ImageField(upload_to='homepage/')
    qr_code = models.ImageField(upload_to='qr_codes', blank=True)
    content = models.TextField()
    event_date = models.DateTimeField(help_text='Date and time of the event')
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, help_text='Check if the event is currently active')

    def __str__(self):
        return self.title

    class Meta:
        app_label = 'core'
        verbose_name_plural = 'Home Pages'
        ordering = ('-event_date',)


class BlogPost(models.Model):
    title = models.CharField(max_length=100)
    image = models.ImageField(upload_to='blog_posts/')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=True, help_text='Check if the blog post is published')
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    home_page = models.ForeignKey(HomePage, on_delete=models.CASCADE)

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


class Contact(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    subject = models.CharField(max_length=100)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True, help_text='Check if the contact entry is valid')

    def clean(self):
        if self.name == 'admin':
            raise ValidationError('The name cannot be admin')
        elif not self.is_active:
            raise ValidationError('The contact entry is invalid')

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = 'Contacts'
        ordering = ('-created_at',)


class About(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    image = models.ImageField(upload_to='about/')
    created_at = models.DateTimeField(auto_now_add=True)
    is_published_about = models.BooleanField(default=True, help_text='Check if the about entry is published')

    def __str__(self):
        return self.title

    class Meta:
        verbose_name_plural = 'Abouts'
        ordering = ('-created_at',)


class Event(models.Model):
    title = models.CharField(max_length=100)
    content = models.TextField()
    image = models.ImageField(upload_to='events/')
    event_date = models.DateTimeField(help_text='Date and time of the event')
    is_published_event = models.BooleanField(default=True, help_text='Check if the event entry is published')
    home_page = models.ForeignKey('core.HomePage', on_delete=models.CASCADE)
    qr_code = models.ImageField(upload_to='qr_codes', blank=True)

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        try:
            qrcode_img = qrcode.make(self.title)
            canvas = Image.new('RGB', (290, 290), 'white')
            draw = ImageDraw.Draw(canvas)
            canvas.paste(qrcode_img)
            fname = f'qr_code-{self.sanitize_filename(self.title)}.png'
            buffer = BytesIO()
            canvas.save(buffer, 'PNG')
            self.qr_code.save(fname, File(buffer), save=False)
            canvas.close()
            logger.debug("QR code saved successfully.")
        except DataOverflowError as e:
            logger.error(f"Error generating QR code for {self.title}: {e}")
        except Exception as e:
            logger.error(f"Error saving QR code for {self.title}: {e}")
        finally:
            super().save(*args, **kwargs)

    def sanitize_filename(self, filename):
        max_length = 100
        if isinstance(filename, str):
            if len(filename) > max_length:
                filename = filename[:max_length]
        elif isinstance(filename, Iterable):
            filename = ''.join(filename)
            if len(filename) > max_length:
                filename = filename[:max_length]
        else:
            filename = str(filename)
        return filename

    class Meta:
        verbose_name_plural = 'Events'
        ordering = ('-event_date',)


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
    color = models.CharField(max_length=7, help_text=hex)

    def __str__(self):
        return str(self.id)
