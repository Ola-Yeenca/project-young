from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from core.models import Event
from .serializers import EventSerializer

class EventViewSet(ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Set is_published=False by default (draft)
        serializer.save(is_published=False)

        return Response(serializer.data, status=status.HTTP_201_CREATED)
