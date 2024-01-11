from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('', views.index, name='index'),
    path('blog/', views.blog, name='blog'),
    path('blog/<int:blog_id>/', views.blog_detail, name='blog_detail'),
    path('blog_list/', views.blog_list, name='blog_list'),
    path('event/', views.event, name='event'),
    path('event/<int:event_id>/', views.event_detail, name='event_detail'),
    path('about/', views.about, name='about'),
    path('contact/', views.contact, name='contact'),
]
