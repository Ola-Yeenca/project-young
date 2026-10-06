from django.db import models

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
    cover = models.ImageField(upload_to="gallery/covers/", blank=True, help_text="Leave blank to use the first photo.")
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
        first = self.items.exclude(image="").first()
        return first.image if first else None


class AlbumItem(MediaBase):
    album = models.ForeignKey(Album, on_delete=models.CASCADE, related_name="items")

    class Meta(MediaBase.Meta):
        verbose_name = "photo or video"
        verbose_name_plural = "photos and videos"

    def __str__(self):
        return self.caption or f"{self.get_kind_display()} {self.pk}"
