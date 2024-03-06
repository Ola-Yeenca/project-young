from django.apps import AppConfig



class SessionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sessions'
    label = 'users_sessions'
    verbose_name = 'Sessions'

    def ready(self):
        import sessions.signals
