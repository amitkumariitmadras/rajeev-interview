# classroom/routing.py

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/classroom/$', consumers.ClassroomConsumer.as_asgi()),  # WebSocket URL
]
