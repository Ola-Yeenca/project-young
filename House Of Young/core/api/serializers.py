from rest_framework.serializers import ModelSerializer
from rest_framework import serializers
from ..models import Event

class EventSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Event
        fields = ('id', 'title', 'content', 'event_date', 'image', 'qr_code', 'is_published_event', 'home_page')
