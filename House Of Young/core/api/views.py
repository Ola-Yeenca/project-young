from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django.contrib import messages
from ..models import Event
from .serializers import EventSerializer
from .utils import generate_qr_code

class EventViewSet(ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def perform_create(self, serializer):
        serializer.save(is_published=False)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        event = serializer.instance
        if not event.qr_code:
            qr_code = generate_qr_code(event.title, event.event_date)
            event.qr_code = qr_code
        event.save()
        message = f"Event '{event.title}' created and pending approval"
        messages.success(request, message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
