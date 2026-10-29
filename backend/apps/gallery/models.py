from django.db import models

from apps.core.image_validation import validate_managed_image
from apps.core.models import City, MediaBase, TimeStampedModel
from apps.events.models import Event


class AlbumQuerySet(models.QuerySet):
    def published(self):
        return self.filter(is_published=True, city__is_active=True)


class Album(TimeStampedModel):
    title = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="albums")
    event = models.ForeignKey(
        Event,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="albums",
        help_text="Link to show this album on the event page too.",
    )
    date = models.DateField(null=True, blank=True)
    cover = models.ImageField(
        upload_to="gallery/covers/",
        blank=True,
        validators=[validate_managed_image],
        help_text="JPEG, PNG or WebP. Leave blank to use the first published photo.",
    )
    is_published = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    objects = AlbumQuerySet.as_manager()

    class Meta:
        ordering = ("order", "-date", "-id")

    def __str__(self):
        return self.title

    @property
    def cover_image(self):
        if self.cover:
            return self.cover
        first = self.items.filter(is_published=True).exclude(image="").first()
        return first.image if first else None


class AlbumItem(MediaBase):
    album = models.ForeignKey(Album, on_delete=models.CASCADE, related_name="items")
    image = models.ImageField(
        upload_to="media/%Y/%m/",
        blank=True,
        validators=[validate_managed_image],
        help_text="Required for photos. JPEG, PNG or WebP; maximum 10 MiB and 40 megapixels.",
    )
    alt = models.CharField(max_length=240, blank=True, help_text="Describe the image for people who cannot see it.")
    is_published = models.BooleanField(default=True)
    views = models.PositiveIntegerField(default=0, editable=False)
    downloads = models.PositiveIntegerField(default=0, editable=False)

    class Meta(MediaBase.Meta):
        verbose_name = "photo or video"
        verbose_name_plural = "photos and videos"

    def __str__(self):
        return self.caption or f"{self.get_kind_display()} {self.pk}"


class PhotoHit(models.Model):
    """One person opening or downloading a photo, counted once per item, kind and day.

    `visitor` is a hash of the address and browser that changes every day, so it counts unique
    people without recognising anyone across days. `device` is only set when the visitor agreed
    to device recognition on the site.
    """

    class Kind(models.TextChoices):
        VIEW = "view", "View"
        DOWNLOAD = "download", "Download"

    item = models.ForeignKey(AlbumItem, on_delete=models.CASCADE, related_name="hits")
    kind = models.CharField(max_length=8, choices=Kind.choices)
    visitor = models.CharField(max_length=16)
    device = models.CharField(max_length=16, blank=True)
    day = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(fields=("item", "kind", "visitor", "day"), name="one_hit_per_visitor_day")]
        indexes = [models.Index(fields=("day", "kind"))]

    def __str__(self):
        return f"{self.get_kind_display()} of {self.item_id} on {self.day}"
