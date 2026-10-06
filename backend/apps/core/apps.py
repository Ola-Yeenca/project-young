from django.apps import AppConfig
from django.db.models.signals import post_migrate


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "Site & cities"

    def ready(self):
        from .roles import sync_team_group

        post_migrate.connect(sync_team_group, dispatch_uid="hoy_sync_team_group")
