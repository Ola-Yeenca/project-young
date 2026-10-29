"""The "HOY team" group: everything the brief says the team manages, nothing more.

Members can manage events, venues, talent, gallery, shop, enquiries, the community list,
HOY Radio, FAQs and site content, and edit existing cities. Only admins add or remove cities, and only admins
manage user accounts and permissions. The team also reads crowd answers, hides unsuitable song requests and
manages DJ logins.

The "DJs" group can only read crowd answers in Studio.
"""

from django.contrib.auth.models import Group, Permission

TEAM_GROUP = "HOY team"
TEAM_APPS = ("core", "events", "talent", "gallery", "shop", "enquiries", "community", "radio")
EXCLUDED = {"add_city", "delete_city", "add_sitesettings", "delete_sitesettings"}
TEAM_CROWD = ("view_tasteanswer", "change_tasteanswer", "manage_djs")

DJ_GROUP = "DJs"
DJ_CROWD = ("view_tasteanswer",)


def _crowd(codenames):
    return Permission.objects.filter(content_type__app_label="crowd", codename__in=codenames)


def sync_team_group(**kwargs):
    group, _ = Group.objects.get_or_create(name=TEAM_GROUP)
    perms = Permission.objects.filter(content_type__app_label__in=TEAM_APPS).exclude(codename__in=EXCLUDED)
    group.permissions.set(perms | _crowd(TEAM_CROWD))
    return group


def sync_dj_group(**kwargs):
    group, _ = Group.objects.get_or_create(name=DJ_GROUP)
    group.permissions.set(_crowd(DJ_CROWD))
    return group
