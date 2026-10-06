"""The "HOY team" group: everything the brief says the team manages, nothing more.

Members can manage events, venues, talent, gallery, shop, enquiries, FAQs and site
content, and edit existing cities. Only admins add or remove cities, and only admins
manage user accounts and permissions.
"""

from django.contrib.auth.models import Group, Permission

TEAM_GROUP = "HOY team"
TEAM_APPS = ("core", "events", "talent", "gallery", "shop", "enquiries")
EXCLUDED = {"add_city", "delete_city", "add_sitesettings", "delete_sitesettings"}


def sync_team_group(**kwargs):
    group, _ = Group.objects.get_or_create(name=TEAM_GROUP)
    perms = Permission.objects.filter(content_type__app_label__in=TEAM_APPS).exclude(codename__in=EXCLUDED)
    group.permissions.set(perms)
    return group
