from rest_framework.serializers import ModelSerializer
from rest_framework import serializers
from ..models import Event

class EventSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Event
        fields = ('id', 'title', 'description', 'event_date', 'image', 'ticket_price', 'tickets_available')
