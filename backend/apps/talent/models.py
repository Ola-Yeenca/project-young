from django.db import models

from apps.core.models import City, MediaBase, TimeStampedModel


class TalentQuerySet(models.QuerySet):
    def published(self):
        return self.filter(is_published=True, city__is_active=True)

    def featured(self):
        return self.published().filter(is_featured=True).order_by("featured_order", "name")


class Talent(TimeStampedModel):
    class Category(models.TextChoices):
        DJ = "dj", "DJ"
        VOCALIST = "vocalist", "Vocalist / singer"
        BAND = "band", "Live band"
        DANCE = "dance", "Dance crew"
        HOST = "host", "Host / MC"
        COMEDY = "comedy", "Comedian"
        OTHER = "other", "Other"

    # The site groups categories into the three filters shown on the line-up.
    GROUPS = {"dj": "DJs", "vocalist": "Live", "band": "Live", "dance": "Live", "host": "Hosts", "comedy": "Hosts", "other": "Live"}

    name = models.CharField(max_length=120, help_text="Artist or stage name.")
    slug = models.SlugField(max_length=120, unique=True)
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="talent", help_text="Home base.")
    category = models.CharField(max_length=20, choices=Category.choices)
    genre = models.CharField(max_length=120, blank=True, help_text="Genre or speciality, e.g. Afrobeats, Amapiano.")
    bio = models.TextField(help_text="Short biography, two or three sentences.")
    previous_work = models.TextField(blank=True, help_text="One item per line: residencies, headline shows, brands.")
    photo = models.ImageField(upload_to="talent/", help_text="Main professional photo. Portrait works best.")
    booking_available = models.BooleanField(default=True)
    travels = models.BooleanField(default=True, help_text="Available for bookings outside the home city.")

    spotify_url = models.URLField(blank=True)
    apple_music_url = models.URLField(blank=True)
    soundcloud_url = models.URLField(blank=True)
    youtube_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    tiktok_url = models.URLField(blank=True)
    website_url = models.URLField(blank=True)

    is_published = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False, help_text="Show on the homepage line-up.")
    featured_order = models.PositiveSmallIntegerField(default=0, help_text="Lower numbers show first.")

    objects = TalentQuerySet.as_manager()

    class Meta:
        ordering = ("name",)
        verbose_name_plural = "talent"

    def __str__(self):
        return self.name

    @property
    def group(self):
        return self.GROUPS.get(self.category, "Live")

    @property
    def previous_work_list(self):
        return [line.strip() for line in self.previous_work.splitlines() if line.strip()]

    @property
    def links(self):
        names = {
            "spotify_url": "Spotify",
            "apple_music_url": "Apple Music",
            "soundcloud_url": "SoundCloud",
            "youtube_url": "YouTube",
            "instagram_url": "Instagram",
            "tiktok_url": "TikTok",
            "website_url": "Website",
        }
        return [{"label": label, "url": getattr(self, field)} for field, label in names.items() if getattr(self, field)]


class TalentMedia(MediaBase):
    talent = models.ForeignKey(Talent, on_delete=models.CASCADE, related_name="media")

    class Meta(MediaBase.Meta):
        verbose_name = "photo or video"
        verbose_name_plural = "photos and videos"

    def __str__(self):
        return self.caption or f"{self.get_kind_display()} {self.pk}"
