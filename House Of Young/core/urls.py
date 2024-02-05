from django.urls import path
from .views import index, blog, blog_detail, blog_list, event, event_detail, about, contact

app_name = 'core'

urlpatterns = [
    path('', index, name='index'),
    path('blog/', blog, name='blog'),
    path('blog/<int:blog_id>/', blog_detail, name='blog_detail'),
    path('blog_list/', blog_list, name='blog_list'),
    path('event/', event, name='event'),
    path('event/<int:event_id>/', event_detail, name='event_detail'),
    path('about/', about, name='about'),
    path('contact/', contact, name='contact'),
]
