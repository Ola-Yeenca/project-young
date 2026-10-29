from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import City, TimeStampedModel


class ProductQuerySet(models.QuerySet):
    def published(self):
        return self.filter(is_published=True)

    def for_city(self, city):
        return self.published().filter(prices__city=city, prices__is_available=True).distinct()


class Product(TimeStampedModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True)
    material = models.CharField(max_length=120, blank=True, help_text="e.g. 240 gsm cotton")
    fit = models.CharField(max_length=60, blank=True, help_text="e.g. Boxy, Relaxed, One size")
    image = models.ImageField(upload_to="shop/")
    is_published = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ("order", "name")

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="shop/")
    alt = models.CharField(max_length=160, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return self.alt or f"Image {self.pk}"


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    label = models.CharField(max_length=40, help_text="Size or variant, e.g. S, M, L, One size")
    sku = models.CharField(max_length=60, blank=True)
    stock = models.PositiveIntegerField(null=True, blank=True, help_text="Leave blank if you do not track stock.")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order", "id")
        constraints = [models.UniqueConstraint(fields=["product", "label"], name="unique_variant_label_per_product")]

    def __str__(self):
        return f"{self.product} · {self.label}"

    @property
    def in_stock(self):
        return self.stock is None or self.stock > 0


class ProductPrice(models.Model):
    """Price and checkout link for one product in one city's currency."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="prices")
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="product_prices")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    checkout_url = models.URLField(blank=True, help_text="Stripe Payment Link (EUR) or Paystack page (NGN) until the native cart exists.")
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ("city__order",)
        constraints = [models.UniqueConstraint(fields=["product", "city"], name="unique_price_per_city")]

    def __str__(self):
        return f"{self.product} · {self.city.currency_symbol}{self.amount}"

    def clean(self):
        super().clean()
        if self.amount is not None and self.amount <= 0:
            raise ValidationError({"amount": "Price must be more than zero."})
