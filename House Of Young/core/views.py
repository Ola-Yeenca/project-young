import logging
from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from .models import BlogPost, Event
from django.contrib.auth.decorators import login_required

logger = logging.getLogger(__name__)

def index(request):
    now = timezone.localtime(timezone.now())
    upcoming_events = Event.objects.filter(is_published=True, event_date__gte=now).order_by('event_date')[:3]
    past_events = Event.objects.filter(is_published=True, event_date__lt=now).order_by('-event_date')[:1]
    recent_blog_posts = BlogPost.objects.filter(is_published=True).order_by('-created_at')[:3]
    context = {
        'upcoming_events': upcoming_events,
        'past_events': past_events,
        'blog_posts': recent_blog_posts,
    }
    return render(request, 'core/index.html', context)


def event(request):
    now = timezone.localtime(timezone.now())
    upcoming_events = Event.objects.filter(is_published=True, event_date__gte=now).order_by('event_date')[:3]
    past_events = Event.objects.filter(is_published=True, event_date__lt=now).order_by('-event_date')[:4]
    recent_blog_posts = BlogPost.objects.filter(is_published=True).order_by('-created_at')[:3]
    context = {
        'upcoming_events': upcoming_events,
        'past_events': past_events,
        'blog_posts': recent_blog_posts,
    }
    return render(request, 'core/event.html', context)

@login_required
def event_detail(request, event_id, slug):
    event = get_object_or_404(Event, id=event_id, slug=slug)
    favourite = request.user.profile.favourites.filter(id=event_id).exists() if hasattr(request.user, 'profile') else False
    context = {
        "event_id": event_id,
        "event": event,
        "favourite": favourite,
    }
    return render(request, "core/event_detail.html", context)

def blog(request):
    blog_posts = BlogPost.objects.filter(is_published=True).order_by('-created_at')
    return render(request, 'core/blog.html', {'blog_posts': blog_posts})

def blog_detail(request, blog_id):
    blog_post = get_object_or_404(BlogPost, id=blog_id)
    return render(request, 'core/blog_detail.html', {'blog_post': blog_post})

def blog_list(request):
    blog_posts = BlogPost.objects.filter(is_published=True).order_by('-created_at')
    return render(request, 'core/blog_list.html', {'blog_posts': blog_posts})

def about(request):
    return render(request, 'core/about.html')

def contact(request):
    return render(request, 'core/contact.html')
