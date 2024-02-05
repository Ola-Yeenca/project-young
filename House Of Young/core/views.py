import logging
import json
from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Q
from .models import BlogPost, Event, Webgel
from .config import HOMEPAGE_CONTENT
from accounts.views import profile
from django.contrib.auth.decorators import login_required

logger = logging.getLogger(__name__)

def get_active_home_page():
    return HOMEPAGE_CONTENT

def index(request):
    webgel = [{'type': int(x.type), 'color': x.color} for x in Webgel.objects.all()]
    webgel_json = json.dumps(webgel)
    home_page = get_active_home_page()

    if home_page:
        events = Event.objects.filter(Q(home_page=True) | Q(sponsors=True)).order_by('event_date')
        now = timezone.localtime(timezone.now())
        upcoming_events = events.filter(event_date__gte=timezone.localtime(timezone.now()).replace(microsecond=0))[:3]
        upcoming_events = events.filter(event_date__gte=timezone.localtime(timezone.now()))[:3]
        past_events = events.filter(event_date__lt=timezone.now()).order_by('-event_date')[:1]
        recent_blog_posts = BlogPost.objects.filter(is_published=True).order_by('-created_at')[:3]
        context = {
            'home_page': home_page,
            'upcoming_events': upcoming_events,
            'past_events': past_events,
            'blog_posts': recent_blog_posts,
            'webgel': webgel_json,
        }
        return render(request, 'core/index.html', context)
    else:
        logger.error("No active home page found.")
        return HttpResponse("No active home page found.")

def blog(request):
    blog_posts = BlogPost.objects.filter(is_published=True).order_by('-created_at')
    return render(request, 'core/blog.html', {'blog_posts': blog_posts})

def blog_detail(request, blog_id):
    blog_post = get_object_or_404(BlogPost, id=blog_id)
    return render(request, 'core/blog_detail.html', {'blog_post': blog_post})

def blog_list(request):
    blog_posts = BlogPost.objects.filter(is_published=True).order_by('-created_at')
    return render(request, 'core/blog_list.html', {'blog_posts': blog_posts})

def event(request):
    home_page = get_active_home_page()

    if home_page:
        events = Event.objects.filter(Q(home_page=True) | Q(sponsors=True)).order_by('event_date')
        upcoming_events = events.filter(event_date__gte=timezone.now())[:3]
        past_events = events.filter(event_date__lt=timezone.now()).order_by('-event_date')[:5]
        unique_venue = Event.objects.values_list('venue', flat=True).distinct()
        unique_sponsor = Event.objects.exclude(sponsor__isnull=True).values_list('sponsor', flat=True).distinct()
        unique_collaborator = Event.objects.exclude(collaborator__isnull=True).values_list('collaborator', flat=True).distinct()
        return render(request, 'core/event.html', {'upcoming_events': upcoming_events, 'past_events': past_events, 'unique_collaborator': unique_collaborator})
    else:
        logger.error("No active home page found.")
        return HttpResponse("No active home page found.")

@login_required
def event_detail(request, event_id):
    event = get_object_or_404(Event, id=event_id)
    blogs = BlogPost.objects.filter(event=event)
    collaborators = Event.objects.exclude(collaborator__isnull=True).values_list('collaborator', flat=True).distinct()
    sponsors = Event.objects.exclude(sponsor__isnull=True).values_list('sponsor', flat=True).distinct()

    # Assuming 'event_id' is a valid attribute of the Event model
    favourite = request.user.profile.favourites.filter(id=event_id).exists() if hasattr(request.user, 'profile') else False

    return render(request, "core/event_detail.html", {
        "event": event,
        "blogs": blogs,
        "collaborators": collaborators,
        "sponsors": sponsors,
        "favourite": favourite,
    })

def about(request):
    if request.method == 'POST':
        pass
    return render(request, 'core/about.html')

def contact(request):
    if request.method == 'POST':
        pass
    return render(request, 'core/contact.html')
