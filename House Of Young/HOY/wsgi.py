import os
from whitenoise import WhiteNoise
from django.core.wsgi import get_wsgi_application



os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'HOY.settings')


application = get_wsgi_application()
application = WhiteNoise(application)
