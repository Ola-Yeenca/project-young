"""The "HOY team" group: everything the brief says the team manages, nothing more.

Members can manage events, venues, talent, gallery, shop, enquiries, FAQs and site
content. They cannot manage user accounts, permissions or delete cities.
"""

from django.contrib.auth.models import Group, Permission

TEAM_GROUP = "HOY team"
TEAM_APPS = ("core", "events", "talent", "gallery", "shop", "enquiries")
EXCLUDED = {"delete_city", "add_sitesettings", "delete_sitesettings"}


def sync_team_group(**kwargs):
    group, _ = Group.objects.get_or_create(name=TEAM_GROUP)
    perms = Permission.objects.filter(content_type__app_label__in=TEAM_APPS).exclude(codename__in=EXCLUDED)
    group.permissions.set(perms)
    return group
