from rest_framework.serializers import ModelSerializer
from rest_framework import serializers
from ..models import Event

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'title', 'description', 'event_date', 'tickets_available', 'ticket_price', 'is_published']
        read_only_fields = ['id']
