from rest_framework import status
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from ..models import Event, HomePage
from .serializers import EventSerializer
from .utils import generate_qr_code

class EventViewSet(ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def perform_create(self, serializer):
        home_page = HomePage.objects.filter(is_active=True).order_by('-event_date').first()

        if home_page:
            serializer.save(home_page=home_page)
        else:
            raise serializers.ValidationError("No active HomePage available")


    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        self.perform_create(serializer)

        event = serializer.save()

        if not event.qr_code:
            qr_code = generate_qr_code(request.data['title'], request.data['date'])
            event.qr_code = qr_code
            event.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)
