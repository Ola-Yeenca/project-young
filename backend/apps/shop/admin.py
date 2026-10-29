from django.contrib import admin

from .models import Product, ProductImage, ProductPrice, ProductVariant


class PriceInline(admin.TabularInline):
    model = ProductPrice
    extra = 1
    fields = ("city", "amount", "checkout_url", "is_available")


class VariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1
    fields = ("label", "sku", "stock", "order")


class ImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    fields = ("image", "alt", "order")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "price_summary", "is_published", "order")
    list_editable = ("is_published", "order")
    list_filter = ("is_published", "prices__city")
    search_fields = ("name", "description")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [PriceInline, VariantInline, ImageInline]

    @admin.display(description="Prices")
    def price_summary(self, obj):
        return " · ".join(f"{p.city.currency_symbol}{p.amount:,.0f}" for p in obj.prices.select_related("city")) or "—"
