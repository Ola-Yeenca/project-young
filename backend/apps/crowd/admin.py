from django.contrib import admin

from .models import TasteAnswer


@admin.register(TasteAnswer)
class TasteAnswerAdmin(admin.ModelAdmin):
    list_display = ("event", "source", "artist", "song", "song_hidden", "created_at")
    list_filter = ("source", "city", "song_hidden")
    search_fields = ("event__title", "artist", "song")
    readonly_fields = ("event", "city", "source", "visitor", "genres", "artist", "song", "created_at", "updated_at")
    list_select_related = ("event__city",)

    def has_add_permission(self, request):
        return False

    # DJs may read answers in Studio only, so the admin needs the change permission even to look.
    def has_view_permission(self, request, obj=None):
        return request.user.has_perm("crowd.change_tasteanswer")
