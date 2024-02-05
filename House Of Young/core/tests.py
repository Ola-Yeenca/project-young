from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from core.models import Organizer, Attendee, BlogPost, Collaborator, Event, Homepage, Session, Sponsor, Venue, Webgel, QRCodeMixin

class TestModel(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email= 'inforhouseofyoung@gmail.com',
            password= 'password'
            )
        user = get_user_model().objects.create_user(email='inforhouseofyoung@gmail.com', password='password')
        organizer = Organizer.objects.create(
            user=user,
            name='House of Young',
        )
        self.event = Event.objects.create(title='Test Event', organizer=self.organizer)
        self.attendee = Attendee.objects.create(user=self.user)
        self.collaborator = Collaborator.objects.create(user=self.user, organizer=self.organizer, event=self.event)


    def test_organizer(self):
        organizer = Organizer.objects.create(user=self.user, name='Test Organizer')
        self.assertEqual(str(organizer), 'Test Organizer')

    def test_qr_code_mixin(self):
        class TestModelWithQRCodeMixin(QRCodeMixin):
            pass

        model_instance = TestModelWithQRCodeMixin()
        qr_code = model_instance.generate_qr_code('test_data')
        self.assertIsNotNone(qr_code)

    def test_homepage(self):
        homepage = Homepage.objects.create(event_date=timezone.now(), is_active=True)
        self.assertEqual(str(homepage), f"Homepage - {homepage.event_date}")

    def test_venue(self):
        venue = Venue.objects.create(address='123 Main St', city='City', country='Country')
        self.assertEqual(str(venue), '123 Main St')

    def test_event(self):
        homepage = Homepage.objects.create(event_date=timezone.now(), is_active=True)
        organizer = Organizer.objects.create(user=self.user, name='Test Organizer')
        venue = Venue.objects.create(address='123 Main St', city='City', country='Country')

        event = Event.objects.create(
            home_page=homepage,
            title='Test Event',
            description='This is a test event',
            event_date=timezone.now(),
            organizer=organizer,
            venue=venue,
            tickets_available=100,
            ticket_price=10.0,
            is_published=True,
            slug='test-event'
        )

        self.assertEqual(str(event), 'Test Event')
        self.assertEqual(event.get_absolute_url(), '/event/1/test-event/')

    def test_collaborator(self):
        collaborator = Collaborator.objects.create(user=self.user, organizer=self.organizer, event=self.event)
        self.assertEqual(str(collaborator), 'testuser - Test Organizer - Test Event')
        organizer = Organizer.objects.create(user=self.user, name='Test Organizer')
        event = Event.objects.create(
            home_page=Homepage.objects.create(event_date=timezone.now(), is_active=True),
            title='Test Event',
            description='This is a test event',
            event_date=timezone.now(),
            organizer=organizer,
            venue=Venue.objects.create(address='123 Main St', city='City', country='Country'),
            tickets_available=100,
            ticket_price=10.0,
            is_published=True,
            slug='test-event'
        )

        collaborator = Collaborator.objects.create(
            user=self.user,
            organizer=organizer,
            event=event
        )

        self.assertEqual(str(collaborator), 'testuser - Test Organizer - Test Event')

        def __str__(self):
            return f"{self.user.username} - {self.organizer.name} - {self.event.title}"


    def test_session(self):
        organizer = Organizer.objects.create(user=self.user)  # Remove the 'email' argument
        event = Event.objects.create(
            home_page=Homepage.objects.create(event_date=timezone.now(), is_active=True),
            title='Test Event',
            description='This is a test event',
            event_date=timezone.now(),
            organizer=organizer,
            venue=Venue.objects.create(address='123 Main St', city='City', country='Country'),
            tickets_available=100,
            ticket_price=10.0,
            is_published=True,
            slug='test-event'
        )

        session = Session.objects.create(
            event=event,
            title='Test Session',
            description='This is a test session',
            start_time=timezone.now(),
            end_time=timezone.now() + timezone.timedelta(hours=1)
        )

        self.assertEqual(str(session), 'Test Session')


    def test_sponsor(self):
        sponsor = Sponsor.objects.create(
            name='Test Sponsor',
            description='This is a test sponsor',
            logo='logo.jpg'
        )

        self.assertEqual(str(sponsor), 'Test Sponsor')

    def test_blog_post(self):
        organizer = Organizer.objects.create(user=self.user, name='Test Organizer')
        event = Event.objects.create(
            home_page=Homepage.objects.create(event_date=timezone.now(), is_active=True),
            title='Test Event',
            description='This is a test event',
            event_date=timezone.now(),
            organizer=organizer,
            venue=Venue.objects.create(address='123 Main St', city='City', country='Country'),
            tickets_available=100,
            ticket_price=10.0,
            is_published=True,
            slug='test-event'
        )

        blog_post = BlogPost.objects.create(
            title='Test Blog Post',
            event=event,
            image='blog_image.jpg',
            content='This is a test blog post',
            is_published=True,
            slug='test-blog-post'
        )

        self.assertEqual(str(blog_post), 'Test Blog Post')

    def test_attendee(self):
        attendee = Attendee.objects.create(user=self.user)
        self.assertEqual(str(attendee), 'testuser')

        def __str__(self):
            return str(self.user.username)


    def test_webgel(self):
        webgel = Webgel.objects.create(type='1', color='#FF0000')
        self.assertEqual(str(webgel), '1')
